import TemperatureChart from "./components/TemperatureChart"
import BatteryVoltageChart from "./components/BatteryVoltageChart"
import SolarPowerChart from "./components/SolarPowerChart"
import CommunicationChart from "./components/CommunicationChart"
import SpaceBackground from "./components/SpaceBackground"
import SatelliteVisualization from "./components/SatelliteVisualization"
import { useState } from "react"
function App() {
  const [selectedSubsystem, setSelectedSubsystem] = useState(null)
  return (
    <div className="app">
    <SpaceBackground />
    <SatelliteVisualization selectedSubsystem={selectedSubsystem} />
      {/* Header */}
      <header className="header">
        <div>
          <h1>🛰️ CubeSat Mission Control</h1>
          <p>Telemetry Monitoring & Anomaly Detection</p>
        </div>

        <div className="system-status">
          <span className="status-dot"></span>
          SYSTEM ONLINE
        </div>
      </header>

      {/* Mission Status */}
      <section className="mission-status">
        <p className="section-title">MISSION STATUS</p>

        <div className="status-card">
          <div>
            <h2>🟢 NOMINAL</h2>
            <p>All satellite systems operating normally</p>
          </div>

          <div className="mission-info">
            <p>Mission Time</p>
            <strong>T+ 04:32:17</strong>
          </div>
        </div>
      </section>

      {/* Telemetry Subsystems */}
      <section>
        <p className="section-title">TELEMETRY SUBSYSTEMS</p>

        <div className="health-grid">

          <div
  className={`health-card ${
    selectedSubsystem === "battery" ? "selected-subsystem" : ""
  }`}
  onClick={() => setSelectedSubsystem("battery")}
>
  <h3>🔋 BATTERY</h3>
  <strong>8.10 V</strong>
  <p>Current: 2.01 A</p>
</div>

          <div
  className={`health-card ${
    selectedSubsystem === "thermal" ? "selected-subsystem thermal-selected" : ""
  }`}
  onClick={() => setSelectedSubsystem("thermal")}
>
  <h3>🌡️ THERMAL</h3>
  <strong>25.8 °C</strong>
  <p>Temperature Normal</p>
</div>

          {/* Solar Card */}
<div
  className={`health-card ${
    selectedSubsystem === "solar"
      ? "selected-subsystem solar-selected"
      : ""
  }`}
  onClick={() => setSelectedSubsystem("solar")}
>
  <h3>☀️ SOLAR</h3>
  <strong>20.4 W</strong>
  <p>Power Generation</p>
</div>

          <div
  className={`health-card ${
    selectedSubsystem === "communication"
      ? "selected-subsystem communication-selected"
      : ""
  }`}
  onClick={() => setSelectedSubsystem("communication")}
>
  <h3>📡 COMMUNICATION</h3>
  <strong>-68 dBm</strong>
  <p>Packet Loss: 0.2%</p>
</div>

          <div className="health-card">
  <h3>🧭 ATTITUDE & GYRO</h3>

  <div
  className={`health-card ${
    selectedSubsystem === "attitude"
      ? "selected-subsystem attitude-selected"
      : ""
  }`}
  onClick={() => setSelectedSubsystem("attitude")}
>
  <h3>🧭 ATTITUDE & GYRO</h3>

  <div className="attitude-values">
    <p>Roll: <strong>12.4°</strong></p>
    <p>Pitch: <strong>4.2°</strong></p>
    <p>Yaw: <strong>45.1°</strong></p>
  </div>

  <div className="gyro-values">
    <p>Gyro X: <strong>0.42</strong></p>
    <p>Gyro Y: <strong>-0.18</strong></p>
    <p>Gyro Z: <strong>1.02</strong></p>
  </div>
</div>

  
</div>
        </div>
      </section>

      {/* Live Telemetry */}
<section>
  <p className="section-title">LIVE TELEMETRY</p>

  <div className="charts-grid">
  <TemperatureChart />
  <BatteryVoltageChart />
  <SolarPowerChart />
  <CommunicationChart />
</div>
</section>

      {/* Anomaly Detection */}
      <section>
        <p className="section-title">ANOMALY DETECTION</p>

        <div className="anomaly-card">
          <h2>✓ No Anomalies Detected</h2>
          <p>ML monitoring system is active</p>
        </div>
      </section>

      {/* AI Mission Assistant */}
      <section>
        <p className="section-title">AI MISSION ASSISTANT</p>

        <div className="ai-card">
          <h2>🤖 Mission AI</h2>

          <p>
            The satellite is operating within normal parameters.
            Continue routine telemetry monitoring.
          </p>
        </div>
      </section>

    </div>
  )
}

export default App