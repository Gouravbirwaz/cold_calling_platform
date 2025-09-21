import os
import time
import threading
from urllib.parse import quote
from flask import Flask, request, jsonify, Response, render_template, abort,send_from_directory
from flask_sqlalchemy import SQLAlchemy
from twilio.twiml.voice_response import VoiceResponse
from dialer import DialerEngineDev
from speech_to_text import SpeechToTextConverter
from flask_cors import CORS
import datetime # Import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv
load_dotenv()

from database.lead_database import calls_bp,db,PhoneCall
VOICE_FOLDER = os.path.join(os.path.dirname(__file__), "ai_voice")
app = Flask(__name__, template_folder="./template")
client = genai.Client(api_key=os.getenv('GEMINI_API'))
# Configure the SQLite database
# The database file 'calls.db' will be created in your project directory
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calls.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Register the blueprint
app.register_blueprint(calls_bp)

# Create the tables in the database (run this once)
with app.app_context():
    db.create_all()

# Initialize other components
dialer = DialerEngineDev()
CORS(app)
dialer_engine = DialerEngineDev()

@app.route("/token", methods=["GET"])
def get_token_route():
    identity = request.values.get('agent_id')
    return dialer_engine.get_token(identity=identity)

@app.route("/make_call", methods=["POST"])
def make_call_route():
    data = request.get_json(force=True)
    agent_id = data.get("agent_id")
    customer_number = data.get("to")
    print(agent_id,customer_number)
    if not agent_id or not customer_number:
        abort(400, description="Missing 'agent_id' or 'to' in JSON body")
    return dialer_engine.make_call_from_agent(agent_id, customer_number, "")

@app.route("/voice", methods=["POST", "GET"])
def voice_webhook():
    to = request.values.get("To")
    return dialer_engine.generate_voice_twiml(to)

@app.route("/join", methods=["POST", "GET"])
def join_webhook():
    room = request.values.get("Room")
    if not room:
        abort(400, description="Missing Room parameter")
    return dialer_engine.generate_join_twiml(room)

@app.route("/get_transcript/<call_sid>")
def get_recording_sid(call_sid):
    transcript_data = dialer.get_transcript(call_sid)
    if not transcript_data or not transcript_data.get("recordings"):
        return jsonify({"error": "No recordings found"}), 404
    
    converter = SpeechToTextConverter()
    results = []
    for rec in transcript_data["recordings"]:
        text = converter.convert(rec["recording_sid"])
        results.append({
            "recording_sid": rec["recording_sid"],
            "url": rec["url"],
            "transcript": text
        })
    return jsonify({"call_sid": call_sid, "recordings": results})

@app.route('/')
def show_ui():
    return render_template('index.html')

@app.route('/incoming_call', methods=['POST'])
def handle_incoming_call():
    agent = dialer_engine._find_available_agent()
    conference_name = f"incoming_conf_{request.values.get('CallSid')}"
    response = VoiceResponse()
    dial = response.dial()
    dial.conference(
        conference_name,
        start_conference_on_enter=True,
        wait_url="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical",
    )
    if agent:
        agent_id, client_identity = agent
        try:
            dialer_engine.client.calls.create(
                to=f"client:{client_identity}",
                from_=dialer_engine.caller_id,
                url=f"{dialer_engine.base_url}/join?Room={quote(conference_name)}",
            )
            dialer_engine._mark_agent_busy(agent_id)
        except Exception as e:
            print("error", e)
    return str(response)

@app.route("/private/agent_status/<agent_id>", methods=["GET"])
def get_agent_status_route(agent_id):
    auth_header = request.headers.get('X-Private-Key')
    if auth_header != dialer_engine.private_key:
        abort(403, description="Unauthorized access")
    return jsonify(dialer_engine.get_agent_status(agent_id))

@app.route("/handle_machine_detection", methods=["POST"])
def handle_machine_detection_webhook():
    answered_by = request.values.get("AnsweredBy")
    vm_audio_url = request.values.get("vm_audio_url")
    conference_name = request.values.get("Room")
    call_sid = request.values.get("CallSid")
    
    if answered_by == "human":
        agent_id = dialer_engine.call_metadata.get(call_sid, {}).get('agent_id')
        if agent_id:
            dialer_engine.set_agent_status(agent_id, "busy")
        
        resp = VoiceResponse()
        resp.dial().conference(conference_name)
        return str(resp)
    elif answered_by == "machine":
        resp = VoiceResponse()
        resp.play(vm_audio_url)
        resp.hangup()
        return str(resp)
    else:
        resp = VoiceResponse()
        resp.say("The call could not be completed.")
        resp.hangup()
        return str(resp)
    
@app.route("/api/send_voicemail", methods=["POST"])
def send_voicemail():
    data = request.get_json()
    to_number = data.get("to")
    voicemail_key = data.get("voicemail")
    print(to_number,voicemail_key)
    return dialer.drop_voice_mail(to_number,voicemail_key)


@app.route('/ai_voice/<filename>')
def serve_voice(filename):
    return send_from_directory(VOICE_FOLDER, filename)


@app.route("/api/gemini_rating", methods=["POST"])
def gemini_rating():
    data = request.json
    transcript = data.get("transcript", "")
    if not transcript:
        return jsonify({"rating": None}), 400

    # Prepare user prompt for rating
    prompt_text = (
        "You are a call quality analyzer. Analyze the following customer call transcript "
        "and return a numeric rating from 1 to 10, where 10 is excellent, 1 is terrible. "
        "Only return the number.\n\n"
        f"Transcript:\n{transcript}"
    )

    contents = [types.Content(role="user", parts=[types.Part(text=prompt_text)])]

    try:
        # Call Gemini LLM
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents
        )

        # Extract the returned text
        result_text = response.candidates[0].content.parts[0].text.strip()

        # Convert to integer rating
        try:
            rating = int(result_text)
            rating = max(1, min(10, rating))  # clamp to 1-10
        except ValueError:
            rating = 0

        return jsonify({"rating": rating})

    except Exception as e:
        print("Error calling Gemini:", e)
        return jsonify({"rating": None}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)), debug=True)