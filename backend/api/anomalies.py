from fastapi import APIRouter

from schemas.telemetry import TelemetryPacket
from services.ml_service import ml_service
from services.rule_engine import diagnose


router = APIRouter(
    prefix="/anomalies",
    tags=["Anomalies"],
)


@router.post("/analyze")
def analyze_telemetry(packet: TelemetryPacket):

    ml_result = ml_service.analyze(packet)

    diagnosis = diagnose(
        packet,
        ml_result["anomaly"],
    )

    return {
        "anomaly": ml_result["anomaly"],
        "anomaly_score": ml_result["anomaly_score"],
        "temperature_rolling_mean": (
            ml_result["temperature_rolling_mean"]
        ),
        "subsystem": diagnosis["subsystem"],
        "severity": diagnosis["severity"],
    }