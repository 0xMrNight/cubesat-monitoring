from pydantic import BaseModel

class AgentRequest(BaseModel):
    anomaly: bool
    anomaly_score: float
    subsystem: str
    severity: str

    temperature: float | None = None
    # temperature_rolling_mean: float | None = None

    battery_voltage: float | None = None
    battery_current: float | None = None
    solar_power: float | None = None

    signal_strength: float | None = None
    # signal_strength_rolling_mean: float | None = None

    packet_loss: float | None = None
    # packet_loss_rolling_mean: float | None = None

    gyro_x: float | None = None
    gyro_y: float | None = None
    gyro_z: float | None = None


class AgentResponse(BaseModel):
    explanation: str
    recommendation: list[str]