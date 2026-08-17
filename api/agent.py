from fastapi import APIRouter

from schemas.agent import AgentRequest, AgentResponse
from services.agent_service import generate_recommendation

router = APIRouter(
    prefix="/agent",
    tags=["Mission Agent"],
)

@router.post("/recommend", response_model=AgentResponse)
def recommend(request: AgentRequest):

    result = generate_recommendation(
        subsystem=request.subsystem,
        severity=request.severity,
    )

    return result