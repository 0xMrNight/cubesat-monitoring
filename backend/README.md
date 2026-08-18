# CubeSat Monitoring Backend

The backend contains the server-side logic of the CubeSat Monitoring System. It receives telemetry, performs anomaly detection using the trained Isolation Forest model, identifies affected subsystems using the rule engine, and provides AI-based explanations through the Mission AI Agent.

 Components
- API – Handles telemetry, anomaly, fault, and AI-agent requests.
- Services – Contains ML anomaly detection, rule-based diagnosis, and AI-agent logic.
- Schemas – Defines and validates telemetry and API data.
- Database – Stores the latest telemetry and fault information.
- Models – Contains the trained ML model and scaler.
- Simulator – Generates normal telemetry and simulated fault conditions.

Technologies
Python-dotenv • FastAPI • Scikit-learn • Pydantic • Google Gemini
