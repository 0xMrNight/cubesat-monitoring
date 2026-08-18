# CubeSat Mission Health Monitoring System

A real-time CubeSat monitoring system that analyzes simulated telemetry and detects abnormal spacecraft behavior.
It uses an Isolation Forest model for anomaly detection and a rule-based system to identify the affected subsystem.

## Features

* Real-time telemetry simulation
* ML-based anomaly detection
* Automatic subsystem fault identification
* Multiple simulated spacecraft fault scenarios
* Real-time monitoring dashboard
* Interactive 3D CubeSat visualization

## Pipeline

```
Telemetry Simulation → FastAPI → ML Anomaly Detection → Rule-Based Diagnosis →  Agent / Analysis → Frontend Dashboard
```

## Tech Stack

* **Frontend:** Vite
* **Backend:** Python, FastAPI
* **Machine Learning:** scikit-learn, Isolation Forest
* **Data Processing:** NumPy, Pandas
* **Model Handling:** Joblib

## Machine Learning

An **Isolation Forest** model is used to detect anomalies in CubeSat telemetry.

The model uses telemetry data along with 20-sample rolling means for temperature, signal strength, and packet loss.

## Fault Scenarios

| Scenario        | Simulated Fault                                        |
| --------------- | ------------------------------------------------------ |
| `thermal`       | Increasing spacecraft temperature                      |
| `power`         | Battery voltage, current and solar power abnormalities |
| `communication` | Reduced signal strength and increased packet loss      |
| `attitude`      | Abnormal gyroscope readings                            |

## Setup

### 1. Clone

```bash
git clone https://github.com/0xMrNight/cubesat-monitoring.git
cd cubesat-monitoring
```

### 2. Backend

Create and activate a Python virtual environment, then install the dependencies:

```bash 
cd backend
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

Add your Gemini API key to .env: `GEMINI_API_KEY=your_api_key`

Start the API:

```bash
uvicorn main:app --reload
```

### 3. Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend connects to the FastAPI backend and provides the telemetry simulation and monitoring interface.

## Data & Model

The notebooks contain the complete data pipeline:

1. Generate synthetic CubeSat telemetry.
2. Inject different fault conditions.
3. Process the dataset.
4. Train the anomaly detection model.
5. Save the trained model and scaler under models/.

## Dataset Attribution

The synthetic telemetry dataset used in this project is built upon the 
[CubeSat in Space (Synthetic Unreal Engine Data)](https://www.kaggle.com/datasets/eberhardtkorf/synthetic-cubesat) dataset from Kaggle, 
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### Modifications Made

1. Processed raw positional and attitude time-series sequences (A, B, C) to derive angular velocities (gyro sensors).
2. Added synthetic telemetry features (battery voltage/current, solar power, temperature, signal strength, packet loss).
3. Injected specific failure modes (thermal, power, communication, attitude faults) with labels and timestamps.

## Authors

- [Siddharth Arumugam](https://github.com/0xMrNight)
- [R Sanjeev Prasad](https://github.com/ironic-san)
- [Raghav Sugumar](https://github.com/Bl4z3-k1n91)
- [Bharath Srinivasan](https://github.com/SBharath2302)
- [Trishant Yadav](https://github.com/trishantyadav)
