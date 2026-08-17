from pathlib import Path

from fastapi import FastAPI

from api.agent import router as agent_router
from api.anomalies import router as anomaly_router
from api.faults import router as fault_router
from api.telemetry import router as telemetry_router
from services.ml_service import ml_service

app = FastAPI(
    title="CubeSat Mission Health API",
    description=(
        "Autonomous CubeSat telemetry anomaly detection "
        "and mission-health monitoring API."
    ),
    version="1.0.0",
)

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "cubesat-mission-health-api",
    }

app.include_router(telemetry_router)
app.include_router(anomaly_router)
app.include_router(fault_router)
app.include_router(agent_router)