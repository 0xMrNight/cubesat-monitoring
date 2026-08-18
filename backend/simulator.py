import argparse
import random
import time

import requests


API_URL = "http://127.0.0.1:8000/telemetry"

INTERVAL = 0.25


def normal_telemetry():
    """Generate varying nominal telemetry."""

    return {
        "battery_voltage": round(
            random.gauss(8.1, 0.08),
            3,
        ),
        "battery_current": round(
            random.gauss(2.0, 0.2),
            3,
        ),
        "solar_power": round(
            random.gauss(20.0, 1.5),
            3,
        ),
        "temperature": round(
            random.gauss(25.0, 1.0),
            3,
        ),
        "signal_strength": round(
            random.gauss(-70.0, 3.0),
            3,
        ),
        "packet_loss": round(
            max(
                0.0,
                random.gauss(0.5, 0.2),
            ),
            3,
        ),
        "gyro_x": round(
            random.gauss(0.05, 0.01),
            4,
        ),
        "gyro_y": round(
            random.gauss(0.03, 0.01),
            4,
        ),
        "gyro_z": round(
            random.gauss(0.02, 0.01),
            4,
        ),
    }


def apply_fault(
    data,
    fault,
    progress,
):
    """Apply a progressive fault."""

    if fault == "thermal":

        data["temperature"] = round(
            25.0 + 30.0 * progress,
            3,
        )

    elif fault == "power":

        data["battery_voltage"] = round(
            8.1 - 1.6 * progress,
            3,
        )

        data["battery_current"] = round(
            2.0 + 1.5 * progress,
            3,
        )

        data["solar_power"] = round(
            20.0 - 15.0 * progress,
            3,
        )

    elif fault == "communication":

        data["signal_strength"] = round(
            -70.0 - 25.0 * progress,
            3,
        )

        data["packet_loss"] = round(
            0.5 + 29.5 * progress,
            3,
        )

    elif fault == "attitude":

        data["gyro_x"] = round(
            0.05 + 1.95 * progress,
            4,
        )

        data["gyro_y"] = round(
            0.03 + 1.47 * progress,
            4,
        )

        data["gyro_z"] = round(
            0.02 + 1.78 * progress,
            4,
        )

    return data


def send_telemetry(data):
    try:
        response = requests.post(
            API_URL,
            json=data,
            timeout=2,
        )

        # Print backend errors instead of crashing on JSON parsing
        if not response.ok:
            print(f"\nAPI ERROR: HTTP {response.status_code}")

            print(f"Response: {response.text}")

            return

        # Check whether the response actually contains JSON
        if not response.text.strip():
            print(f"\nAPI ERROR: Empty response " f"(HTTP {response.status_code})")
            return

        try:
            result = response.json()

        except ValueError:
            print(f"\nAPI ERROR: Backend returned non-JSON response")
            print(f"HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return

        analysis = result.get(
            "analysis",
            {},
        )

        score = analysis.get(
            "anomaly_score",
            "?",
        )

        anomaly = analysis.get(
            "anomaly",
            "?",
        )

        temp_mean = analysis.get(
            "temperature_rolling_mean",
            "?",
        )

        signal_mean = analysis.get(
            "signal_strength_rolling_mean",
            "?",
        )

        packet_mean = analysis.get(
            "packet_loss_rolling_mean",
            "?",
        )

        subsystem = analysis.get("subsystem") or "-"

        severity = analysis.get("severity") or "-"

        print(
            f"T={data['temperature']:6.2f} | "
            f"Tmean={temp_mean:>7.3f} | "
            f"Signal={data['signal_strength']:7.2f} | "
            # f"Smean={signal_mean!s:>7} | "
            f"Loss={data['packet_loss']:6.2f}% | "
            # f"Lmean={packet_mean!s:>7} | "
            f"Score={score:>8.4f} | "
            f"Anomaly={str(anomaly):<5} | "
            f"Subsystem={subsystem:<13} | "
            f"Severity={severity:<8}"
        )

    except requests.exceptions.ConnectionError:
        print("\nAPI ERROR: Could not connect to FastAPI.")
        print(f"Is the server running at {API_URL}?")

    except requests.exceptions.Timeout:
        print("\nAPI ERROR: FastAPI request timed out.")

    except requests.exceptions.RequestException as exc:
        print(f"\nAPI REQUEST ERROR: {exc}")


def run(fault=None):
    print()
    print("=" * 46)
    print("       CUBESAT TELEMETRY SIMULATOR")
    print("=" * 46)

    if fault:
        print(f"MODE: {fault.upper()} FAULT")
    else:
        print("MODE: NORMAL")

    print(f"Sending every {INTERVAL} seconds")

    # print("Rolling window: 20")

    print("Press Ctrl+C to stop.")
    print()

    progress = 0.0

    while True:
        data = normal_telemetry()

        if fault:

            progress += 0.05

            progress = min(
                progress,
                1.0,
            )

            data = apply_fault(
                data,
                fault,
                progress,
            )

        send_telemetry(data)

        time.sleep(INTERVAL)


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--fault",
        choices=[
            "thermal",
            "power",
            "communication",
            "attitude",
        ],
        default=None,
    )

    args = parser.parse_args()

    try:
        run(args.fault)

    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    main()
