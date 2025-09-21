from database.lead_database import  db, Agent   # import app, db, and model
from main import app
agents_data = [
    {"agent_id": "AG001", "name": "Alice Johnson", "phone_number": "+1555010001", "responsibility": "Inbound Sales"},
    {"agent_id": "AG002", "name": "Bob Smith", "phone_number": "+1555010002", "responsibility": "Technical Support"},
    {"agent_id": "AG003", "name": "Charlie Davis", "phone_number": "+1555010003", "responsibility": "Customer Success"},
    {"agent_id": "AG004", "name": "Diana Miller", "phone_number": "+1555010004", "responsibility": "Billing Queries"},
    {"agent_id": "AG005", "name": "Ethan Brown", "phone_number": "+1555010005", "responsibility": "Outbound Sales"},
    {"agent_id": "AG006", "name": "Fiona Wilson", "phone_number": "+1555010006", "responsibility": "Escalation Handling"},
    {"agent_id": "AG007", "name": "George Clark", "phone_number": "+1555010007", "responsibility": "Retention Specialist"},
    {"agent_id": "AG008", "name": "Hannah Lewis", "phone_number": "+1555010008", "responsibility": "Quality Assurance"},
    {"agent_id": "AG009", "name": "Ian Walker", "phone_number": "+1555010009", "responsibility": "Technical Escalation"},
    {"agent_id": "AG010", "name": "Julia Scott", "phone_number": "+1555010010", "responsibility": "Onboarding New Clients"}
]

with app.app_context():
    for agent in agents_data:
        db.session.add(Agent(**agent))
    db.session.commit()
