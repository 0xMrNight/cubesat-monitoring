def diagnose(packet, analysis):
    """
    Analyze anomalous telemetry and identify all affected
    spacecraft subsystems.

    The ML model is authoritative for anomaly detection.
    This rule engine only interprets the telemetry evidence.
    """

    # ==========================================================
    # NORMAL TELEMETRY
    # ==========================================================

    if not analysis["anomaly"]:
        return {
            "subsystem": None,
            "affected_subsystems": [],
            "severity": "normal",
            "confidence": 0.0,
            "evidence": {
                "thermal": 0.0,
                "power": 0.0,
                "communication": 0.0,
                "attitude": 0.0,
            },
            "reasons": {
                "thermal": [],
                "power": [],
                "communication": [],
                "attitude": [],
            },
        }

    # ==========================================================
    # TELEMETRY
    # ==========================================================

    temperature = packet.temperature

    battery_voltage = packet.battery_voltage
    battery_current = packet.battery_current
    solar_power = packet.solar_power

    signal_strength = packet.signal_strength
    packet_loss = packet.packet_loss

    gyro_x = packet.gyro_x
    gyro_y = packet.gyro_y
    gyro_z = packet.gyro_z

    # ==========================================================
    # ROLLING FEATURES FROM V2.2
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
    # EVIDENCE
    # ==========================================================

    evidence = {
        "thermal": 0.0,
        "power": 0.0,
        "communication": 0.0,
        "attitude": 0.0,
    }

    reasons = {
        "thermal": [],
        "power": [],
        "communication": [],
        "attitude": [],
    }

    # ==========================================================
    # THERMAL
    # ==========================================================

    temperature_deviation = (
        temperature - temperature_mean
    )

    if temperature > 45:
        evidence["thermal"] += 1.0

        reasons["thermal"].append(
            f"Temperature is high ({temperature:.2f} °C)."
        )

    elif temperature > 35:
        evidence["thermal"] += 0.5

        reasons["thermal"].append(
            f"Temperature is elevated ({temperature:.2f} °C)."
        )

    if temperature_deviation > 5:
        evidence["thermal"] += 0.5

        reasons["thermal"].append(
            f"Temperature is {temperature_deviation:.2f} °C "
            "above its recent rolling mean."
        )

    # ==========================================================
    # POWER
    # ==========================================================

    if battery_voltage < 7.0:
        evidence["power"] += 1.0

        reasons["power"].append(
            f"Battery voltage is low ({battery_voltage:.2f} V)."
        )

    elif battery_voltage < 7.5:
        evidence["power"] += 0.5

        reasons["power"].append(
            f"Battery voltage is reduced ({battery_voltage:.2f} V)."
        )

    if battery_current > 3.0:
        evidence["power"] += 0.75

        reasons["power"].append(
            f"Battery current is elevated ({battery_current:.2f} A)."
        )

    if solar_power < 10.0:
        evidence["power"] += 0.75

        reasons["power"].append(
            f"Solar power is low ({solar_power:.2f} W)."
        )

    # ==========================================================
    # COMMUNICATION
    # ==========================================================

    signal_degradation = (
        signal_strength < -85
        or (
            signal_strength - signal_strength_mean < -10
        )
    )

    packet_loss_degradation = (
        packet_loss > 10
        or (
            packet_loss - packet_loss_mean > 5
        )
    )

    if signal_degradation:
        evidence["communication"] += 1.0

        reasons["communication"].append(
            f"Signal strength is weak ({signal_strength:.2f} dBm)."
        )

    if packet_loss_degradation:
        evidence["communication"] += 1.0

        reasons["communication"].append(
            f"Packet loss is high ({packet_loss:.2f}%)."
        )

    # ==========================================================
    # ATTITUDE
    # ==========================================================

    gyro_values = {
        "gyro_x": gyro_x,
        "gyro_y": gyro_y,
        "gyro_z": gyro_z,
    }

    for axis, value in gyro_values.items():

        absolute_value = abs(value)

        if absolute_value > 1.0:

            evidence["attitude"] += 1.0

            reasons["attitude"].append(
                f"{axis} is abnormal ({value:.2f})."
            )

        elif absolute_value > 0.5:

            evidence["attitude"] += 0.5

            reasons["attitude"].append(
                f"{axis} is elevated ({value:.2f})."
            )

    # ==========================================================
    # FIND AFFECTED SUBSYSTEMS
    # ==========================================================

    affected_subsystems = [
        subsystem
        for subsystem, score in evidence.items()
        if score > 0
    ]

    # ==========================================================
    # UNKNOWN ANOMALY
    # ==========================================================

    if not affected_subsystems:
        return {
            "subsystem": "unknown",
            "affected_subsystems": [],
            "severity": "warning",
            "confidence": 0.0,
            "evidence": evidence,
            "reasons": reasons,
        }

    # ==========================================================
    # PRIMARY SUBSYSTEM
    # ==========================================================

    # Highest evidence score becomes the primary subsystem.

    primary_subsystem = max(
        affected_subsystems,
        key=lambda subsystem: evidence[subsystem],
    )

    # ==========================================================
    # SEVERITY
    # ==========================================================

    max_evidence = max(
        evidence[subsystem]
        for subsystem in affected_subsystems
    )

    # Multiple affected subsystems indicate a more serious
    # spacecraft-level event.

    if len(affected_subsystems) >= 3:
        severity = "critical"

    elif max_evidence >= 2.0:
        severity = "critical"

    elif max_evidence >= 1.0:
        severity = "warning"

    else:
        severity = "low"

    # ==========================================================
    # CONFIDENCE
    # ==========================================================

    # Confidence reflects strength of telemetry evidence,
    # not model probability.

    if max_evidence >= 2.0:
        confidence = 0.9

    elif max_evidence >= 1.0:
        confidence = 0.8

    else:
        confidence = 0.6

    return {
        "subsystem": primary_subsystem,
        "affected_subsystems": affected_subsystems,
        "severity": severity,
        "confidence": confidence,
        "evidence": evidence,
        "reasons": reasons,
    }