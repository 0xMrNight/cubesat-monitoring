function SatelliteVisualization({ selectedSubsystem }) {
  return (
    <div className={`satellite-area ${selectedSubsystem || ""}`}>

      {/* Orbit */}
      <div className="orbit orbit-1"></div>
      <div className="orbit orbit-2"></div>

      {/* Satellite */}
      <div className={`satellite ${selectedSubsystem || ""}`}>

        <div className="solar-panel left-panel"></div>

        <div className="satellite-body">
          <div className="satellite-window"></div>
        </div>

        <div className="solar-panel right-panel"></div>

        <div className="antenna"></div>

      </div>

      {/* Battery */}
      {selectedSubsystem === "battery" && (
        <div className="subsystem-status battery-status">
          🔋 LOW POWER MONITORING
        </div>
      )}

      {/* Thermal */}
      {selectedSubsystem === "thermal" && (
        <div className="subsystem-status thermal-status">
          🌡️ THERMAL MONITORING
        </div>
      )}

      {/* Solar */}
{selectedSubsystem === "solar" && (
  <>
    <div className="subsystem-status solar-status">
      ☀️ SOLAR POWER GENERATION
    </div>

    <div className="solar-info">
      <strong>20.4 W</strong>
      <span>Power Generation</span>
      <span>Solar Array: ACTIVE</span>
    </div>
  </>
)}

      {/* Communication */}
      {selectedSubsystem === "communication" && (
        <>
          <div className="communication-beam"></div>

          <div className="subsystem-status communication-status">
            📡 COMMUNICATION LINK
          </div>

          <div className="signal-info">
            <strong>-68 dBm</strong>
            <span>Signal Strength</span>
            <span>Packet Loss: 0.2%</span>
          </div>
        </>
      )}

      {/* Attitude */}
      {selectedSubsystem === "attitude" && (
        <>
          <div className="subsystem-status attitude-status">
            🧭 ATTITUDE CONTROL
          </div>

          <div className="attitude-info">
            <span>ROLL: 12.4°</span>
            <span>PITCH: 4.2°</span>
            <span>YAW: 45.1°</span>
          </div>
        </>
      )}

      {/* Satellite Label */}
      <div className="satellite-label">
        <strong>CUBESAT-01</strong>
        <span>LEO • ACTIVE</span>
      </div>

    </div>
  )
}

export default SatelliteVisualization