from fastapi import APIRouter, status

from database.repository import repository
from schemas.telemetry import TelemetryPacket
from services.ml_service import ml_service
from services.rule_engine import diagnose


router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"],
)


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
)
def receive_telemetry(
    packet: TelemetryPacket,
):
    """
    Final telemetry analysis pipeline:

    1. ML runs.
    2. If ML says NORMAL:
           -> NORMAL
           -> Rule Engine is NOT executed.

    3. If ML says ANOMALY:
           -> Run Rule Engine.

    4. Rule Engine finds evidence:
           -> CONFIRMED ANOMALY.

    5. Rule Engine finds no evidence:
           -> NORMAL.
    """

    # ==========================================================
    # 1. RUN ML
    # ==========================================================

    ml_result = ml_service.analyze(packet)

    # ==========================================================
    # 2. ML SAYS NORMAL
    #
    # IMPORTANT:
    # Rule Engine is NOT called here.
    # ==========================================================

    if not ml_result["anomaly"]:

        analysis = {
            "anomaly": False,
            "ml_anomaly": False,

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

            "subsystem": None,
            "affected_subsystems": [],

            "severity": "normal",
            "confidence": 0.0,

            
        }

    # ==========================================================
    # 3. ML SAYS ANOMALY
    #
    # NOW AND ONLY NOW run Rule Engine.
    # ==========================================================

    else:

        diagnosis = diagnose(
            packet,
            ml_result,
        )

        # ======================================================
        # Check whether Rule Engine found actual evidence
        # ======================================================

        has_evidence = any(
            score > 0
            for score in diagnosis["evidence"].values()
        )

        # ======================================================
        # 4A. ML ANOMALY + NO EVIDENCE
        #     -> NORMAL
        # ======================================================

        if not has_evidence:

            analysis = {
                "anomaly": False,
                "ml_anomaly": True,

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

                "subsystem": None,
                "affected_subsystems": [],

                "severity": "normal",
                "confidence": 0.0,

                "evidence": diagnosis["evidence"],
                "reasons": diagnosis["reasons"],
            }

        # ======================================================
        # 4B. ML ANOMALY + EVIDENCE
        #     -> CONFIRMED ANOMALY
        # ======================================================

        else:

            analysis = {
                "anomaly": True,
                "ml_anomaly": True,

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

                "subsystem": diagnosis["subsystem"],
                "affected_subsystems": (
                    diagnosis["affected_subsystems"]
                ),

                "severity": diagnosis["severity"],
                "confidence": diagnosis["confidence"],

                "evidence": diagnosis["evidence"],
                "reasons": diagnosis["reasons"],
            }

    # ==========================================================
    # 5. SAVE RESULT
    # ==========================================================

    repository.save(
        telemetry=packet.model_dump(),
        analysis=analysis,
    )

    # ==========================================================
    # 6. RETURN RESPONSE
    # ==========================================================

    return {
        "status": "accepted",

        "telemetry": packet.model_dump(
            mode="json"
        ),

        "analysis": analysis,
    }


@router.get("/latest")
def get_latest_telemetry():
    return repository.get_latest()
