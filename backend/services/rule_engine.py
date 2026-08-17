def diagnose(packet, analysis):
    if not analysis["anomaly"]:
        return {
            "subsystem": None,
            "severity": "normal",
            "reason": "Telemetry is within the learned normal range.",
        }

    # ==========================================================
    # 2. CURRENT TELEMETRY VALUES
    # ==========================================================

    temperature = packet.temperature

    signal_strength = packet.signal_strength

    packet_loss = packet.packet_loss

    battery_voltage = packet.battery_voltage

    battery_current = packet.battery_current

    solar_power = packet.solar_power

    gyro_x = packet.gyro_x
    gyro_y = packet.gyro_y
    gyro_z = packet.gyro_z

    # ==========================================================
    # 3. V2.2 ROLLING FEATURES
    # ==========================================================

    temperature_mean = analysis[
        "temperature_rolling_mean"
    ]

    signal_strength_mean = analysis[
        "signal_strength_rolling_mean"
    ]

    packet_loss_mean = analysis[
        "packet_loss_rolling_mean"
    ]

    # ==========================================================
    # 4. THERMAL DIAGNOSIS
    # ==========================================================

    temperature_deviation = (
        temperature - temperature_mean
    )

    # Critical thermal condition.
    #
    # Example:
    # temperature = 52°C
    # rolling mean = 30°C
    #
    # Large deviation + high absolute temperature
    # strongly indicates a thermal problem.

    if (
        temperature > 45
        or temperature_deviation > 5
    ):
        return {
            "subsystem": "thermal",
            "severity": "critical",
            "reason": (
                "Temperature is significantly above "
                "its recent 20-sample baseline."
            ),
        }

    # Warning thermal condition.

    if (
        temperature > 35
        or temperature_deviation > 3
    ):
        return {
            "subsystem": "thermal",
            "severity": "warning",
            "reason": (
                "Temperature is elevated relative "
                "to its recent 20-sample baseline."
            ),
        }

    # ==========================================================
    # 5. POWER DIAGNOSIS
    # ==========================================================

    # Strong combined power fault:
    #
    # Voltage ↓
    # Current ↑
    # Solar power ↓

    if (
        battery_voltage < 7.0
        and battery_current > 3.0
        and solar_power < 10.0
    ):
        return {
            "subsystem": "power",
            "severity": "critical",
            "reason": (
                "Battery voltage is low, battery current "
                "is elevated, and solar power is reduced."
            ),
        }

    # Less severe power deviation.

    if (
        battery_voltage < 7.5
        or battery_current > 3.0
        or solar_power < 10.0
    ):
        return {
            "subsystem": "power",
            "severity": "warning",
            "reason": (
                "Power telemetry has deviated "
                "from nominal operating conditions."
            ),
        }

    # ==========================================================
    # 6. COMMUNICATION DIAGNOSIS
    # ==========================================================

    # Signal strength becomes more negative when
    # communication quality deteriorates.

    signal_degradation = (
        signal_strength < -85
        or (
            signal_strength - signal_strength_mean
            < -10
        )
    )

    # packet_loss is represented as a percentage.
    #
    # 0.5 = 0.5%
    # 10  = 10%
    # 30  = 30%

    packet_loss_degradation = (
        packet_loss > 10
        or (
            packet_loss - packet_loss_mean
            > 5
        )
    )

    # Strong communication fault:
    #
    # Signal ↓
    # Packet loss ↑

    if (
        signal_degradation
        and packet_loss_degradation
    ):
        return {
            "subsystem": "communication",
            "severity": "critical",
            "reason": (
                "Signal strength has degraded while "
                "packet loss has increased significantly."
            ),
        }

    # Partial communication degradation.

    if (
        signal_degradation
        or packet_loss_degradation
    ):
        return {
            "subsystem": "communication",
            "severity": "warning",
            "reason": (
                "Communication telemetry has "
                "deviated from its recent baseline."
            ),
        }

    # ==========================================================
    # 7. ATTITUDE DIAGNOSIS
    # ==========================================================

    # Large angular velocity indicates abnormal
    # spacecraft rotation.

    if (
        abs(gyro_x) > 1.0
        or abs(gyro_y) > 1.0
        or abs(gyro_z) > 1.0
    ):
        return {
            "subsystem": "attitude",
            "severity": "critical",
            "reason": (
                "Angular velocity indicates "
                "abnormal spacecraft rotation."
            ),
        }

    # ==========================================================
    # 8. UNKNOWN ANOMALY
    # ==========================================================

    # ML detected something abnormal, but none of
    # our subsystem rules matched.

    return {
        "subsystem": "unknown",
        "severity": "warning",
        "reason": (
            "Anomalous telemetry was detected, "
            "but no subsystem-specific rule "
            "was triggered."
        ),
    }