from pydantic import BaseModel


class Diagnosis(BaseModel):
    subsystem: str | None
    affected_subsystems: list[str]

    severity: str
    confidence: float

    evidence: dict[str, float]
    reasons: dict[str, list[str]]


class AnomalyResult(BaseModel):
    anomaly: bool
    anomaly_score: float

    temperature_rolling_mean: float
    signal_strength_rolling_mean: float
    packet_loss_rolling_mean: float

    diagnosis: Diagnosis | None = None