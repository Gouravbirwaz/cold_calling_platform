import os
import requests
import speech_recognition as sr
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

class SpeechToTextConverter:
    def __init__(self):
        self.ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
        self.AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
        self.client = Client(self.ACCOUNT_SID, self.AUTH_TOKEN)
        self.recognizer = sr.Recognizer()

    def download_recording(self, recording_sid):
        output_file = os.path.join(os.path.dirname(__file__), "recordings", f"{recording_sid}_recording.wav")
        """Download a recording from Twilio by SID"""
        recording = self.client.recordings(recording_sid).fetch()
        recording_url = f"https://api.twilio.com{recording.uri.replace('.json', '.wav')}"
        
        response = requests.get(recording_url, auth=(self.client.username, self.client.password))
        if response.status_code == 200:
            with open(output_file, "wb") as f:
                f.write(response.content)
            print(f"Recording saved as {output_file}")
            return output_file
        else:
            raise Exception(f"Failed to download recording: {response.text}")

    def transcribe_recording(self, file_path):
        """Convert recording to text using SpeechRecognition"""
        with sr.AudioFile(file_path) as source:
            audio_data = self.recognizer.record(source)
            try:
                text = self.recognizer.recognize_google(audio_data)
                return text
            except sr.UnknownValueError:
                return "Could not understand audio"
            except sr.RequestError as e:
                return f"STT request failed: {e}"

    def convert(self, recording_sid):
        """Download + transcribe in one step"""
        file_path = self.download_recording(recording_sid)
        return self.transcribe_recording(file_path)


