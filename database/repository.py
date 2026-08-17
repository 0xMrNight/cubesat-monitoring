from typing import Any

class TelemetryRepository:
    def __init__(self):
        self.latest_telemetry = None
        self.latest_analysis = None
        self.latest_fault = None

    def save(self, telemetry, analysis):

        self.latest_telemetry = telemetry
        self.latest_analysis = analysis

        if analysis.get("anomaly"):
            self.latest_fault = {
                "timestamp": telemetry.get("timestamp"),
                "subsystem": analysis.get("subsystem"),
                "severity": analysis.get("severity"),
                "anomaly_score": analysis.get("anomaly_score"),
            }

    def get_latest(self):
        return {
            "telemetry": self.latest_telemetry,
            "analysis": self.latest_analysis,
        }

    def get_latest_fault(self):
        return self.latest_fault

repository = TelemetryRepository()