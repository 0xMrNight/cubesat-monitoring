from fastapi import APIRouter

from schemas.telemetry import TelemetryPacket
from services.ml_service import ml_service
from services.rule_engine import diagnose


router = APIRouter(
    prefix="/anomalies",
    tags=["Anomalies"],
)


@router.post("/analyze")
def analyze_telemetry(
    packet: TelemetryPacket,
):

    # ==========================================================
    # 1. ML ANOMALY DETECTION
    # ==========================================================

    ml_result = ml_service.analyze(packet)

    # ==========================================================
    # 2. NORMAL TELEMETRY
    # ==========================================================

    if not ml_result["anomaly"]:

        return {
            "anomaly": False,
            "anomaly_score": ml_result["anomaly_score"],
            "temperature_rolling_mean": (
                ml_result["temperature_rolling_mean"]
            ),
            "signal_strength_rolling_mean": (
                ml_result["signal_strength_rolling_mean"]
            ),
            "packet_loss_rolling_mean": (
                ml_result["packet_loss_rolling_mean"]
            ),
            "diagnosis": None,
        }

    # ==========================================================
    # 3. DETERMINISTIC EVIDENCE ENGINE
    # ==========================================================

    diagnosis = diagnose(
        packet,
        ml_result,
    )

    # ==========================================================
    # 4. RETURN DETERMINISTIC ANALYSIS
    # ==========================================================

    return {
        "anomaly": True,

        "anomaly_score": (
            ml_result["anomaly_score"]
        ),

        "temperature_rolling_mean": (
            ml_result["temperature_rolling_mean"]
        ),

        "signal_strength_rolling_mean": (
            ml_result["signal_strength_rolling_mean"]
        ),

        "packet_loss_rolling_mean": (
            ml_result["packet_loss_rolling_mean"]
        ),

        "diagnosis": diagnosis,
    }