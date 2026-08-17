from pathlib import Path
from collections import deque

import joblib
import numpy as np

from schemas.telemetry import TelemetryPacket

FEATURES = [
    "battery_voltage",
    "battery_current",
    "solar_power",
    "temperature",
    "temperature_rolling_mean",
    "signal_strength",
    "signal_strength_rolling_mean",
    "packet_loss",
    "packet_loss_rolling_mean",
    "gyro_x",
    "gyro_y",
    "gyro_z",
]


class MLService:
    """Inference service for Isolation Forest model."""

    ANOMALY_THRESHOLD = 0.0
    ROLLING_WINDOW = 20

    def __init__(
        self,
        model_path: str = "models/isolation_forest_v22.pkl",
        scaler_path: str = "models/scaler_v22.pkl",
    ):
        self.model_path = Path(model_path)
        self.scaler_path = Path(scaler_path)

        self.temperature_history = deque(maxlen=self.ROLLING_WINDOW)

        self.signal_strength_history = deque(maxlen=self.ROLLING_WINDOW)

        self.packet_loss_history = deque(maxlen=self.ROLLING_WINDOW)

        self.model = None
        self.scaler = None

        self.load_artifacts()

    def load_artifacts(self):
        """Load the pre-trained model and scaler."""

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Isolation Forest model not found: "
                f"{self.model_path}"
            )

        if not self.scaler_path.exists():
            raise FileNotFoundError(
                f"Scaler not found: {self.scaler_path}"
            )

        self.model = joblib.load(self.model_path)
        self.scaler = joblib.load(self.scaler_path)

    @staticmethod
    def _rolling_mean(history: deque, value: float) -> float:
        """Add a value to a rolling history and return its mean."""

        history.append(value)
        return float(np.mean(history))

    def _build_feature_vector(
        self,
        packet: TelemetryPacket,
    ) -> np.ndarray:
        """
        Build the exact 12-feature vector.
        """

        temperature_rolling_mean = self._rolling_mean(
            self.temperature_history,
            packet.temperature,
        )

        signal_strength_rolling_mean = self._rolling_mean(
            self.signal_strength_history,
            packet.signal_strength,
        )

        packet_loss_rolling_mean = self._rolling_mean(
            self.packet_loss_history,
            packet.packet_loss,
        )

        values = [
            packet.battery_voltage,
            packet.battery_current,
            packet.solar_power,
            packet.temperature,
            temperature_rolling_mean,
            packet.signal_strength,
            signal_strength_rolling_mean,
            packet.packet_loss,
            packet_loss_rolling_mean,
            packet.gyro_x,
            packet.gyro_y,
            packet.gyro_z,
        ]

        return np.array(
            values,
            dtype=float,
        ).reshape(1, -1)

    def analyze(
        self,
        packet: TelemetryPacket,
    ) -> dict:
        """
        Analyze one telemetry packet.

        Anomaly rule:
            anomaly_score < 0 → anomaly
            anomaly_score >= 0 → normal
        """

        if self.model is None or self.scaler is None:
            raise RuntimeError(
                "ML model or scaler has not been loaded."
            )

        X = self._build_feature_vector(packet)

        X_scaled = self.scaler.transform(X)

        # Isolation Forest decision function
        anomaly_score = float(
            self.model.decision_function(X_scaled)[0]
        )

        anomaly = anomaly_score < self.ANOMALY_THRESHOLD

        return {
            "anomaly": bool(anomaly),
            "anomaly_score": anomaly_score,

            "temperature_rolling_mean": float(X[0, 4]),

            "signal_strength_rolling_mean": float(X[0, 6]),

            "packet_loss_rolling_mean": float(X[0, 8]),
        }


ml_service = MLService()