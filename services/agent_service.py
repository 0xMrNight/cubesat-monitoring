def generate_recommendation(
    subsystem: str,
    severity: str,
) -> dict:

    recommendations = {
        "thermal": [
            "Enter thermal-safe mode",
            "Reduce non-essential power loads",
            "Increase telemetry monitoring frequency",
            "Notify mission operator",
        ],

        "power": [
            "Reduce non-essential power loads",
            "Check battery state",
            "Prioritize essential spacecraft systems",
            "Notify mission operator",
        ],

        "communication": [
            "Increase communication monitoring",
            "Retry transmission",
            "Check communication subsystem health",
            "Notify mission operator",
        ],

        "attitude": [
            "Increase attitude monitoring frequency",
            "Verify attitude-control subsystem status",
            "Prepare safe-mode transition if rotation continues",
            "Notify mission operator",
        ],
    }

    explanations = {
        "thermal":
            "A rapid thermal excursion has been detected.",

        "power":
            "Abnormal power-system behaviour has been detected.",

        "communication":
            "Communication quality has degraded significantly.",

        "attitude":
            "Abnormal spacecraft rotational behaviour has been detected.",
    }

    return {
        "explanation": explanations.get(
            subsystem,
            "An unidentified spacecraft anomaly has been detected."
        ),

        "recommendation": recommendations.get(
            subsystem,
            ["Increase telemetry monitoring", "Notify mission operator"]
        ),
    }