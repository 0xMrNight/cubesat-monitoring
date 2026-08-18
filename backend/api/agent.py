from fastapi import APIRouter

from schemas.agent import AgentRequest, AgentResponse
from services.agent_service import generate_recommendation


router = APIRouter(
    prefix="/agent",
    tags=["Mission Agent"],
)


@router.post(
    "/recommend",
    response_model=AgentResponse,
)
def recommend(request: AgentRequest):

    result = generate_recommendation(
        subsystem=request.subsystem,
        affected_subsystems=request.affected_subsystems,
        severity=request.severity,
        confidence=request.confidence,
        evidence=request.evidence,
        reasons=request.reasons,

        telemetry={
            "temperature": request.temperature,

            "battery_voltage": request.battery_voltage,
            "battery_current": request.battery_current,
            "solar_power": request.solar_power,

            "signal_strength": request.signal_strength,
            "packet_loss": request.packet_loss,

            "gyro_x": request.gyro_x,
            "gyro_y": request.gyro_y,
            "gyro_z": request.gyro_z,
        },
    )

    return result