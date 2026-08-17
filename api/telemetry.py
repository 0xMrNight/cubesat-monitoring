from fastapi import APIRouter, status

from database.repository import repository
from schemas.telemetry import TelemetryPacket
from services.ml_service import ml_service
from services.rule_engine import diagnose


router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"],
)

@router.post("", status_code=status.HTTP_202_ACCEPTED)
def receive_telemetry(packet: TelemetryPacket):

    ml_result = ml_service.analyze(packet)

    diagnosis = diagnose(
        packet,
        ml_result,
    )

    analysis = {
        "anomaly": ml_result["anomaly"],
        "anomaly_score": ml_result["anomaly_score"],
        "temperature_rolling_mean": (
            ml_result["temperature_rolling_mean"]
        ),
        "subsystem": diagnosis["subsystem"],
        "severity": diagnosis["severity"],
    }

    repository.save(
        telemetry=packet.model_dump(),
        analysis=analysis,
    )

    return {
        "status": "accepted",
        "analysis": analysis,
        "telemetry": packet.model_dump(),
    }

@router.get("/latest")
def get_latest_telemetry():
    return repository.get_latest()@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
)
def receive_telemetry(
    packet: TelemetryPacket,
):
    """
    Receive and analyze one telemetry packet.

    Pipeline:

        Telemetry
            ↓
        ML Service
            ↓
        Anomaly Detection
            ↓
        Rule Engine
            ↓
        Subsystem Diagnosis
            ↓
        Severity
            ↓
        Store
            ↓
        Response
    """

    # ------------------------------------------------------
    # STEP 1 — ML ANOMALY DETECTION
    # ------------------------------------------------------

    ml_result = ml_service.analyze(
        packet
    )

    # ml_result contains:

    # {
    #     "anomaly": True/False,
    #     "anomaly_score": float,
    #     "temperature_rolling_mean": float,
    #     "signal_strength_rolling_mean": float,
    #     "packet_loss_rolling_mean": float
    # }

    # ------------------------------------------------------
    # STEP 2 — RULE-BASED SUBSYSTEM DIAGNOSIS
    # ------------------------------------------------------

    # IMPORTANT:
    #
    # Pass the ENTIRE ml_result.
    #
    # Do NOT do:
    #
    # diagnose(packet, ml_result["anomaly"])
    #
    # because that only passes True/False.
    #
    # The rule engine also needs the rolling features.

    diagnosis = diagnose(
        packet,
        ml_result,
    )

    # ------------------------------------------------------
    # STEP 3 — COMBINE ML + RULE RESULTS
    # ------------------------------------------------------

    analysis = {
        **ml_result,
        **diagnosis,
    }

    # Example:

    # {
    #     "anomaly": True,
    #     "anomaly_score": -0.24,
    #     "temperature_rolling_mean": 34.8,
    #     "signal_strength_rolling_mean": -70.4,
    #     "packet_loss_rolling_mean": 0.7,
    #     "subsystem": "thermal",
    #     "severity": "critical",
    #     "reason": "Temperature is significantly above..."
    # }

    # ------------------------------------------------------
    # STEP 4 — STORE TELEMETRY
    # ------------------------------------------------------

    # Use this section according to your repository.
    #
    # If your repository currently has something like:
    #
    # repository.save_telemetry(packet, analysis)
    #
    # keep that call here.
    #
    # For example:
    #
    # repository.save(
    #     packet=packet,
    #     analysis=analysis,
    # )


    return {
        "status": "accepted",
        "telemetry": packet.model_dump(
            mode="json"
        ),
        "analysis": analysis,
    }