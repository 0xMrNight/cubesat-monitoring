from datetime import datetime, timezone
from pydantic import BaseModel, Field

class TelemetryPacket(BaseModel):
    """Telemetry packet received from the CubeSat simulator."""

    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    battery_voltage: float = Field(description="Battery voltage in volts")

    battery_current: float = Field(description="Battery current in amperes")

    solar_power: float = Field(
        ge=0,
        description="Solar power in watts"
    )

    temperature: float = Field(description="Temperature in degrees Celsius")

    signal_strength: float = Field(description="Communication signal strength in dBm")

    packet_loss: float = Field(
        ge=0,
        le=100,
        description="Packet loss percentage"
    )

    gyro_x: float = Field(description="Angular velocity around X axis")
    gyro_y: float = Field(description="Angular velocity around Y axis")
    gyro_z: float = Field(description="Angular velocity around Z axis")