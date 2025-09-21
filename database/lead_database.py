from flask import Blueprint, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import datetime

# Create the Blueprint
calls_bp = Blueprint("calls", __name__, url_prefix="/api")

# The database object will be initialized in app.py and imported here
db = SQLAlchemy()

# Define the database model
class PhoneCall(db.Model):
    __tablename__ = 'phone_calls'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=True)
    caller_number = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=True)
    use_name = db.Column(db.String(20), nullable=False)
    call_duration_seconds = db.Column(db.Integer, nullable=True)
    call_timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    note = db.Column(db.String(200), nullable=True)  

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "caller_number": self.caller_number,
            "status": self.status,
            "call_duration_seconds": self.call_duration_seconds,
            "call_timestamp": self.call_timestamp.isoformat(),
            "note": self.note,
            "name":self.use_name
        }

class Agent(db.Model):
    __tablename__ = 'agents'

    id = db.Column(db.Integer, primary_key=True)  # Auto-increment PK
    agent_id = db.Column(db.String(20), unique=True, nullable=False)  # Custom agent identifier
    name = db.Column(db.String(50), nullable=False)  # Agent's name
    phone_number = db.Column(db.String(20), nullable=False)  # Contact number
    responsibility = db.Column(db.String(100), nullable=True)  # Role/responsibility



# Route: get all calls
@calls_bp.route('/calls', methods=['GET'])
def get_all_calls_api():
    calls = PhoneCall.query.order_by(PhoneCall.call_timestamp.desc()).all()
    return jsonify([call.to_dict() for call in calls])

# Route: add a new call
@calls_bp.route('/add_call_record', methods=['POST'])
def add_call_record_api():
    try:
        data = request.get_json()
        caller_number = data.get('caller_number')
        status = data.get('status')
        duration = data.get('duration')

        if not caller_number or not status:
            return jsonify({'error': 'Missing required fields'}), 400

        new_call = PhoneCall(
            caller_number=caller_number,
            status=status,
            call_duration_seconds=duration,
            call_timestamp=datetime.datetime.now()
        )
        db.session.add(new_call)
        db.session.commit()

        return jsonify({'message': 'Call record added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calls_bp.route('/add_note', methods=['POST'])
def add_note_to_user():
    try:
        data = request.get_json()
        lead_id = data.get('user_id')
        note = data.get('note')

        if not lead_id or not note:
            return jsonify({'error': 'user_id and note are required'}), 400

        # Fetch the PhoneCall entry
        user_instance = PhoneCall.query.filter_by(user_id=lead_id).first()
        if not user_instance:
            return jsonify({'error': f'No record found for user_id {lead_id}'}), 404

        # Update note
        user_instance.note = note
        db.session.commit()

        return jsonify({'message': 'Note added successfully', 'call': user_instance.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
@calls_bp.route("/agents", methods=["GET"])
def get_agents():
    try:
        agents = Agent.query.all()
        results = [
            {
                "id": agent.id,
                "agent_id": agent.agent_id,
                "name": agent.name,
                "phone_number": agent.phone_number,
                "responsibility": agent.responsibility
            }
            for agent in agents
        ]
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
