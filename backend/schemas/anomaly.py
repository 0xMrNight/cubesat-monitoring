from typing import Optional
from pydantic import BaseModel

class AnomalyResult(BaseModel):
    anomaly: bool
    anomaly_score: float

    temperature_rolling_mean: float
    signal_strength_rolling_mean: float
    packet_loss_rolling_mean: float

    subsystem: Optional[str] = None
    severity: Optional[str] = None