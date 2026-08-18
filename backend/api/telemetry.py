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
    Receive and analyze one telemetry packet.

    Pipeline:

        Telemetry
            ↓
        V2.2 ML
            ↓
        Rule Engine
            ↓
        Deterministic Diagnosis
            ↓
        Store
            ↓
        Response
    """

    # ==========================================================
    # 1. ML ANOMALY DETECTION
    # ==========================================================

    ml_result = ml_service.analyze(packet)

    # ==========================================================
    # 2. DETERMINISTIC EVIDENCE ANALYSIS
    # ==========================================================

    diagnosis = diagnose(
        packet,
        ml_result,
    )

    # ==========================================================
    # 3. COMBINE ML + RULE ENGINE
    # ==========================================================

    analysis = {
        **ml_result,
        **diagnosis,
    }

    # ==========================================================
    # 4. STORE RESULT
    # ==========================================================

    repository.save(
        telemetry=packet.model_dump(),
        analysis=analysis,
    )

    # ==========================================================
    # 5. RESPONSE
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