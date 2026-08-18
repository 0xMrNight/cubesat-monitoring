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
    """
    Analyze one telemetry packet.

    Decision pipeline:

        ML
         ↓
        anomaly?
         ├── NO → NORMAL
         │
         └── YES
              ↓
          Rule Engine
              ↓
          evidence?
              ├── NO → NORMAL
              └── YES → ANOMALY
    """

    # ==========================================================
    # 1. ML ANOMALY DETECTION
    # ==========================================================

    ml_result = ml_service.analyze(packet)

    # ==========================================================
    # 2. RULE ENGINE
    # ==========================================================

    diagnosis = diagnose(
        packet,
        ml_result,
    )

    # ==========================================================
    # 3. FINAL ANOMALY DECISION
    # ==========================================================

    has_evidence = any(
        score > 0
        for score in diagnosis["evidence"].values()
    )

    confirmed_anomaly = (
        ml_result["anomaly"]
        and has_evidence
    )

    # ==========================================================
    # 4. RESPONSE
    # ==========================================================

    return {
        "anomaly": bool(
            confirmed_anomaly
        ),

        "ml_anomaly": bool(
            ml_result["anomaly"]
        ),

        "anomaly_score": (
            ml_result["anomaly_score"]
        ),

        "temperature_rolling_mean": (
            ml_result[
                "temperature_rolling_mean"
            ]
        ),

        "signal_strength_rolling_mean": (
            ml_result[
                "signal_strength_rolling_mean"
            ]
        ),

        "packet_loss_rolling_mean": (
            ml_result[
                "packet_loss_rolling_mean"
            ]
        ),

        "diagnosis": diagnosis,
    }