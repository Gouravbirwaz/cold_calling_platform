import os
import time
import threading
from typing import Optional
from urllib.parse import quote
from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse, Dial, Play
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv
from flask import jsonify
load_dotenv()


VOICEMAIL_URLS = {
    "male": "http://127.0.0.1:8080/ai_voice/male_voice.wav",
    "female": "http://127.0.0.1:8080/ai_voice/female_voice.wav"
}   


class DialerEngineDev:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.api_key_sid = os.getenv("TWILIO_API_KEY_SID")
        self.api_key_secret = os.getenv("TWILIO_API_SECRET")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twiml_app_sid = os.getenv("TWILIO_TWIML_APP_SID")
        self.client = Client(self.account_sid, self.auth_token)
        self.caller_id = os.getenv("TWILIO_CALLER_ID")
        self.base_url = os.getenv("PUBLIC_URL")
        self.private_key = os.getenv("PRIVATE_KEY")
        required_vars = [
            self.account_sid, self.api_key_sid, self.api_key_secret,
            self.auth_token, self.twiml_app_sid, self.caller_id, self.base_url
        ]
        if not all(required_vars):
            raise ValueError("Missing one or more required Twilio environment variables.")

        
        self.conferences = {}
        # Stores conference name associated with a customer call SID for AMD handling
        self.call_metadata = {}

    def register_agent(self, agent_id: str, client_identity: str):
        self.agents[agent_id] = {"identity": client_identity, "status": "available"}
        return {"registered": agent_id, "identity": client_identity}

    def get_agent_status(self, agent_id: str):
        agent = self.agents.get(agent_id)
        if not agent:
            return {"error": "unknown agent"}, 404
        return {"agent_id": agent_id, "status": agent["status"]}

    def set_agent_status(self, agent_id: str, status: str):
        if agent_id not in self.agents:
            return {"error": "unknown agent"}, 404
        self.agents[agent_id]["status"] = status
        return {"agent_id": agent_id, "status": status}

    def _find_available_agent(self) -> Optional[tuple]:
        for aid, meta in self.agents.items():
            if meta.get("status") == "available":
                return aid, meta["identity"]
        return None

    def _mark_agent_busy(self, agent_id: str):
        if agent_id in self.agents:
            self.agents[agent_id]["status"] = "busy"

    def _mark_agent_available(self, agent_id: str):
        if agent_id in self.agents:
            self.agents[agent_id]["status"] = "available"

    def get_token(self, identity="web_user"):
        token = AccessToken(self.account_sid, self.api_key_sid, self.api_key_secret, identity=identity)
        voice_grant = VoiceGrant(
            outgoing_application_sid=self.twiml_app_sid,
            incoming_allow=True
        )
        token.add_grant(voice_grant)
        return jsonify(token=token.to_jwt())

    def make_call_from_agent(self, agent_id: str, customer_number: str, voicemail_audio_url: str):        
        conference_name = f"conf_{agent_id}_{int(time.time())}"
        
        try:
            # Create the outbound call to the customer with Answering Machine Detection (AMD)
            customer_call = self.client.calls.create(
                to=customer_number,
                from_=self.caller_id,
                # This TwiML URL will be used if a human answers
                url=f"{self.base_url}/join?Room={quote(conference_name)}",
                # The machineDetection parameter is key for detecting voicemails
                machine_detection='DetectMessageEnd',
                # This webhook is triggered by Twilio after AMD completes
                # It will have a CallStatus of `completed` and a `AnsweredBy` parameter
                fallback_url=f"{self.base_url}/handle_machine_detection?vm_audio_url={quote(voicemail_audio_url)}&Room={quote(conference_name)}",
                status_callback=f"{self.base_url}/call_status",
                status_callback_event=['initiated', 'ringing', 'answered', 'completed'],
                status_callback_method="POST",
                record=True
            )
            self.call_metadata[customer_call.sid] = {'conference_name': conference_name, 'agent_id': agent_id}
            
            return jsonify({"conference": conference_name, "customer_call_sid": customer_call.sid}),200
        except Exception as e:
            print("errror is",e)
            return jsonify({"error": str(e)}), 500

    def get_transcript(self, call_sid):
        recordings = self.client.recordings.list(call_sid=call_sid)
        transcript_data = []
        for rec in recordings:
            transcript_data.append({
                "recording_sid": rec.sid,
                "url": f"https://api.twilio.com{rec.uri.replace('.json', '.mp3')}"
            })
        return {"call_sid": call_sid, "recordings": transcript_data}
    
    def generate_twiml_for_agent_softphone(self, to: str):
        resp = VoiceResponse()
        if to and to.startswith("room:"):
            # Outbound call: Agent joining the conference
            room_name = to.replace("room:", "")
            resp.dial().conference(
                room_name,
                start_conference_on_enter=True,
                end_conference_on_exit=True
            )
        else:
            # Incoming call: Route to an available agent
            available_agent = self._find_available_agent()
            if available_agent:
                agent_id, client_identity = available_agent
                
                # Create a unique conference for the incoming call
                conference_name = f"incoming_conf_{int(time.time())}"
                
                # Dial the agent's softphone and place them in the conference
                resp.dial().conference(
                    conference_name,
                    start_conference_on_enter=True,
                    end_conference_on_exit=True,
                    wait_url="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
                )
                
                # The customer is placed in the conference via a separate call. We need to tell the customer to wait.
                # However, Twilio routes the call directly to the TwiML response. So the agent is called first.
                
                # Dial the agent's softphone using a separate call.
                try:
                    self.client.calls.create(
                        to=f"client:{client_identity}",
                        from_=self.caller_id,
                        url=f"{self.base_url}/join?Room={quote(conference_name)}",
                        status_callback=f"{self.base_url}/call_status",
                        status_callback_event=['answered', 'completed'],
                        status_callback_method="POST"
                    )
                    self._mark_agent_busy(agent_id)
                except Exception as e:
                    print(f"Error calling agent: {e}")
                    resp.say("Sorry, we couldn't connect you to an agent.")
            else:
                resp.say("Thank you for calling. All of our agents are currently busy. Please try again later.")
        return str(resp)

    def generate_join_twiml(self, room: str):
        resp = VoiceResponse()
        dial = Dial()
        dial.conference(room, start_conference_on_enter=True, end_conference_on_exit=True, record=False)
        resp.append(dial)
        return str(resp)
    
    def handle_amd_result(self, answered_by: str, vm_audio_url: str, conference_name: str, call_sid: str):
        resp = VoiceResponse()
        if answered_by == "human":
            # A human answered, connect to the conference
            resp.dial().conference(conference_name)
        elif answered_by == "machine":
            # A machine/voicemail answered, drop the pre-recorded message
            resp.say("Playing the voicemail message now.")
            resp.play(vm_audio_url)
            # Hang up the call after the message
            resp.hangup()
        else:
            # The call was not answered or an error occurred
            resp.say("The call could not be completed.")
            resp.hangup()
        return str(resp)
    
    def drop_voice_mail(self,to_number,voice):
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=self.caller_id,
                twiml=f'<Response><Play>{VOICEMAIL_URLS[voice]}</Play></Response>'
            )
            return jsonify({"message": "Voicemail call initiated", "call_sid": call.sid})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        