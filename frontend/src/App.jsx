import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { CanvasTexture, DoubleSide, MathUtils } from "three";

import Satellite3D from "./Satellite3D";
import SplitFlapText from "./SplitFlapText";

import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const SEND_INTERVAL_MS = 1500;
const FAULTS = [
  { id: "normal", anomalyState: "normal", label: "Nominal", shortLabel: "Normal", accent: "mint", hint: "All systems within expected bounds" },
  { id: "thermal", anomalyState: "overheating", label: "Overheating", shortLabel: "Overheating", accent: "amber", hint: "Heat shimmer + droplets" },
  { id: "communication", anomalyState: "signal_loss", label: "Signal loss", shortLabel: "Signal loss", accent: "violet", hint: "Antenna search + static" },
  { id: "attitude", anomalyState: "unstable_motion", label: "Unstable motion", shortLabel: "Unstable motion", accent: "cyan", hint: "Wobble + dizzy stars" },
  { id: "power", anomalyState: "power_failure", label: "Power failure", shortLabel: "Power failure", accent: "rose", hint: "Dim mode + safe tilt" },
];

const NOMINAL = {
  batteryVoltage: 8.1,
  batteryCurrent: 2.0,
  solarPower: 20.0,
  temperature: 25.0,
  signalStrength: -70,
  packetLoss: 0.5,
  gyroX: 0.05,
  gyroY: 0.03,
  gyroZ: 0.02,
};

function randomBetween(value, variation) {
  return Number((value + (Math.random() * 2 - 1) * variation).toFixed(3));
}

function createTelemetry(fault, agitation) {
  const packet = {
    timestamp: new Date().toISOString(),
    battery_voltage: randomBetween(NOMINAL.batteryVoltage, 0.08),
    battery_current: randomBetween(NOMINAL.batteryCurrent, 0.08),
    solar_power: randomBetween(NOMINAL.solarPower, 0.22),
    temperature: randomBetween(NOMINAL.temperature + Math.min(agitation * 0.48, 48), 0.7),
    signal_strength: randomBetween(NOMINAL.signalStrength, 3),
    packet_loss: Math.max(0, randomBetween(NOMINAL.packetLoss, 0.5)),
    gyro_x: randomBetween(agitation > 18 ? agitation / 14 : NOMINAL.gyroX, 0.02),
    gyro_y: randomBetween(agitation > 18 ? -agitation / 18 : NOMINAL.gyroY, 0.02),
    gyro_z: randomBetween(agitation > 18 ? agitation / 22 : NOMINAL.gyroZ, 0.02),
  };

  if (fault === "thermal") {
    packet.temperature = randomBetween(82, 2.5);
  }
  if (fault === "power") {
    packet.battery_voltage = randomBetween(5.8, 0.1);
    packet.battery_current = randomBetween(2.8, 0.2);
    packet.solar_power = Math.max(0, randomBetween(0.4, 0.1));
  }
  if (fault === "communication") {
    packet.signal_strength = randomBetween(-104, 3);
    packet.packet_loss = randomBetween(38, 5);
  }
  if (fault === "attitude") {
    packet.gyro_x = randomBetween(2.3, 0.3);
    packet.gyro_y = randomBetween(-1.8, 0.3);
    packet.gyro_z = randomBetween(1.5, 0.3);
  }

  return packet;
}

function createLocalAnalysis(packet) {
  const anomalies = [];
  if (packet.temperature > 70) anomalies.push({ metric: "temperature", value: packet.temperature, severity: "critical", recommended_action: "Enter thermal-safe mode" });
  if (packet.battery_voltage < 6.5) anomalies.push({ metric: "battery_voltage", value: packet.battery_voltage, severity: "critical", recommended_action: "Reduce non-essential loads" });
  if (packet.signal_strength < -90 || packet.packet_loss > 20) anomalies.push({ metric: "signal_strength", value: packet.signal_strength, severity: "warning", recommended_action: "Reacquire ground station link" });
  if (Math.max(Math.abs(packet.gyro_x), Math.abs(packet.gyro_y), Math.abs(packet.gyro_z)) > 5) anomalies.push({ metric: "gyro_x", value: packet.gyro_x, severity: "critical", recommended_action: "Switch to attitude-safe mode" });

  return {
    anomaly_count: anomalies.length,
    anomalies,
    ml: { model_status: "local_fallback", is_anomaly: anomalies.length > 0, score: anomalies.length ? -0.82 : 0.04 },
    alert: {
      status: anomalies.length ? "alert" : "nominal",
      priority: anomalies.some((item) => item.severity === "critical") ? "critical" : anomalies.length ? "warning" : "none",
      actions: [...new Set(anomalies.map((item) => item.recommended_action))],
      summary: anomalies.length ? "Abnormal telemetry detected in the local simulator." : "All monitored values are within configured limits.",
    },
  };
}

function getSubsystem(anomalies) {
  const metrics = anomalies.map((anomaly) => anomaly.metric);
  if (metrics.some((metric) => metric.includes("temperature"))) return "Thermal";
  if (metrics.some((metric) => ["battery_voltage", "battery_current", "solar_power"].includes(metric))) return "Power";
  if (metrics.some((metric) => ["signal_strength", "packet_loss"].includes(metric))) return "Communications";
  if (metrics.some((metric) => metric.startsWith("gyro"))) return "Attitude";
  return "All systems";
}

function inferAnomalyState(analysis) {
  const metrics = (analysis?.anomalies || []).map((anomaly) => anomaly.metric);
  if (metrics.some((metric) => metric.includes("temperature"))) return "overheating";
  if (metrics.some((metric) => ["signal_strength", "packet_loss"].includes(metric))) return "signal_loss";
  if (metrics.some((metric) => ["battery_voltage", "battery_current", "solar_power"].includes(metric))) return "power_failure";
  if (metrics.some((metric) => metric.startsWith("gyro"))) return "unstable_motion";
  return "normal";
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const ocean = context.createLinearGradient(0, 0, 1024, 512);
  ocean.addColorStop(0, "#082f49");
  ocean.addColorStop(0.48, "#0e7490");
  ocean.addColorStop(1, "#042f4a");
  context.fillStyle = ocean;
  context.fillRect(0, 0, 1024, 512);

  context.fillStyle = "#6b8f71";
  const continents = [
    [210, 172, 105, 48, -0.25], [288, 235, 55, 106, 0.34], [475, 152, 82, 42, -0.1],
    [531, 222, 58, 84, 0.2], [705, 158, 112, 52, 0.12], [795, 253, 63, 91, -0.3],
    [895, 335, 74, 35, 0.16], [124, 325, 57, 33, 0.1],
  ];
  continents.forEach(([x, y, width, height, angle]) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.beginPath();
    context.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  context.fillStyle = "rgba(219, 239, 220, 0.26)";
  for (let index = 0; index < 22; index += 1) {
    const x = (index * 83 + 45) % 1024;
    const y = 38 + ((index * 47) % 430);
    context.beginPath();
    context.ellipse(x, y, 25 + (index % 4) * 16, 5 + (index % 3) * 3, index * 0.22, 0, Math.PI * 2);
    context.fill();
  }

  return new CanvasTexture(canvas);
}

function EarthBackdrop() {
  const earthTexture = useMemo(() => createEarthTexture(), []);
  const earth = useRef(null);

  useEffect(() => () => earthTexture.dispose(), [earthTexture]);

  useFrame((_, delta) => {
    if (earth.current) earth.current.rotation.y += delta * 0.045;
  });

  return (
    <group position={[0, -1.85, -3.05]} ref={earth}>
      <mesh>
        <sphereGeometry args={[2.72, 64, 64]} />
        <meshStandardMaterial map={earthTexture} roughness={0.9} metalness={0.03} />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[2.72, 64, 64]} />
        <meshBasicMaterial color="#39b7d5" transparent opacity={0.09} side={DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2.25, 0, 0]}>
        <torusGeometry args={[3.05, 0.008, 12, 160]} />
        <meshBasicMaterial color="#35d6ff" transparent opacity={0.48} />
      </mesh>
    </group>
  );
}

function OrbitPath() {
  return (
    <group rotation={[0.6, -0.18, 0.18]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.65, 0.012, 12, 180]} />
        <meshBasicMaterial color="#6fe7ff" transparent opacity={0.23} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.65, 0.025, 12, 180]} />
        <meshBasicMaterial color="#e1faff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function App() {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [agitation, setAgitation] = useState(0);
  const [selectedFault, setSelectedFault] = useState("normal");
  const [anomalyState, setAnomalyState] = useState("normal");
  const [telemetry, setTelemetry] = useState(NOMINAL);
  const [analysis, setAnalysis] = useState(createLocalAnalysis({
    temperature: NOMINAL.temperature,
    battery_voltage: NOMINAL.batteryVoltage,
    signal_strength: NOMINAL.signalStrength,
    packet_loss: NOMINAL.packetLoss,
    gyro_x: 0,
    gyro_y: 0,
    gyro_z: 0,
  }));
  const [history, setHistory] = useState([34.2, 34.4, 34.1, 34.6, 34.2, 34.5, 34.2]);
  const [apiState, setApiState] = useState("connecting");
  const [lastSent, setLastSent] = useState(null);
  const [packetCount, setPacketCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const sendLock = useRef(false);

  const isAlert = analysis.anomaly_count > 0;
  const subsystem = getSubsystem(analysis.anomalies || []);
  const severity = analysis.alert?.priority || "none";

  const handleInteraction = useCallback((intensity) => {
    setAgitation((value) => Math.min(100, value * 0.88 + intensity * 0.9));
  }, []);

  const sendTelemetry = useCallback(async () => {
    if (sendLock.current) return;
    sendLock.current = true;
    const packet = createTelemetry(selectedFault, agitation);
    let nextAnalysis = createLocalAnalysis(packet);

    try {
      const response = await fetch(`${API_BASE}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const payload = await response.json();
      nextAnalysis = payload.analysis || nextAnalysis;
      // BACKEND INTEGRATION: map FastAPI anomaly response to this visual state.
      // Replace this adapter with the backend's explicit anomalyState when available.
      setAnomalyState(
        payload.analysis?.anomaly_count > 0
          ? inferAnomalyState(payload.analysis)
          : "normal",
      );
      setApiState("online");
      setLastError("");
    } catch {
      setApiState("offline");
      setLastError("Backend unavailable — local simulation continues");
    } finally {
      setTelemetry({
        batteryVoltage: packet.battery_voltage,
        batteryCurrent: packet.battery_current,
        solarPower: packet.solar_power,
        temperature: packet.temperature,
        signalStrength: packet.signal_strength,
        packetLoss: packet.packet_loss,
        gyroX: packet.gyro_x,
        gyroY: packet.gyro_y,
        gyroZ: packet.gyro_z,
      });
      setAnalysis(nextAnalysis);
      setHistory((values) => [...values.slice(-11), packet.temperature]);
      setPacketCount((value) => value + 1);
      setLastSent(new Date());
      sendLock.current = false;
    }
  }, [agitation, selectedFault]);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (mounted) setApiState(response.ok ? "online" : "offline");
      } catch {
        if (mounted) setApiState("offline");
      }
    };
    checkHealth();
    const healthTimer = window.setInterval(checkHealth, 10000);
    return () => {
      mounted = false;
      window.clearInterval(healthTimer);
    };
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(sendTelemetry, 0);
    const timer = window.setInterval(sendTelemetry, SEND_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [sendTelemetry]);

  useEffect(() => {
    const timer = window.setInterval(() => setAgitation((value) => Math.max(0, value * 0.965 - 0.12)), 120);
    return () => window.clearInterval(timer);
  }, []);

  const formattedTime = lastSent ? lastSent.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
  const orbitPosition = ((packetCount * 1.7) % 360).toFixed(1);

  return (
    <div className={`dashboard ${isAlert ? "dashboard-alert" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span>◈</span></div>
          <div>
            <p className="eyebrow">ORBITAL SYSTEMS / MISSION CONTROL</p>
            <h1>ODYSSEY <span>01</span></h1>
          </div>
        </div>
        <div className="topbar-meta">
          <div className="orbit-readout"><span className="readout-label">ORBIT</span><strong>LEO · {orbitPosition}°</strong></div>
          <div className={`connection-pill ${apiState}`}><span className="status-pulse" />{apiState === "online" ? "API LINKED" : apiState === "connecting" ? "CONNECTING" : "LOCAL MODE"}</div>
        </div>
      </header>

      <main className="mission-shell">
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="split-flap-hero">
              <SplitFlapText
                words={isAlert ? ["ALERT ACTIVE", "CHECK SYSTEM", "MISSION HOLD"] : ["LAUNCH READY", "SYNC ONLINE", "SIGNAL LIVE"]}
                flipDuration={0.12}
                stagger={0.06}
                cycleDelay={2400}
                charset="alphanumeric"
                flipsPerChar={8}
                tileColor="#111827"
                textColor="#f8fafc"
                tileRadius={8}
                gap={6}
                fontSize={52}
                loop
                padTo={12}
              />
            </div>
            <div className={`mission-state ${isAlert ? "alert" : "nominal"}`}><span className="state-dot" />{isAlert ? `${severity.toUpperCase()} ANOMALY` : "ALL SYSTEMS NOMINAL"}</div>
            <h2>CubeSat <em>health</em><br />in real time.</h2>
            <p className="hero-description">A live digital twin for spacecraft telemetry, subsystem health, and orbital attitude. Rotate the vehicle to stress its attitude envelope and watch the mission response.</p>
            <div className="hero-stats">
              <div><span>MISSION ELAPSED</span><strong>04:18:27</strong></div>
              <div><span>PACKETS INGESTED</span><strong>{String(packetCount).padStart(4, "0")}</strong></div>
              <div><span>LAST DOWNLINK</span><strong>{formattedTime}</strong></div>
            </div>
          </div>
          <div className="satellite-panel panel-glass">
            <div className="panel-heading"><div><span className="panel-kicker">LIVE DIGITAL TWIN</span><h3>Orbital attitude</h3></div><span className="panel-coordinate">X {rotation.x.toFixed(2)}° · Y {rotation.y.toFixed(2)}° · Z {rotation.z.toFixed(2)}°</span></div>
            <div className="canvas-container" onContextMenu={(event) => event.preventDefault()}>
              <Canvas camera={{ position: [0, 0.1, 6.4], fov: 42 }} dpr={[1, 2]}>
                <color attach="background" args={["#071321"]} />
                <fog attach="fog" args={["#071321", 8, 14]} />
                <ambientLight intensity={1.25} />
                <directionalLight position={[4, 4, 5]} intensity={3.4} color="#fff7dc" />
                <directionalLight position={[-4, -2, 1]} intensity={1.25} color="#53cdf0" />
                <Stars radius={90} depth={40} count={1100} factor={2.2} saturation={0} fade speed={0.18} />
                <EarthBackdrop />
                <OrbitPath />
                <Satellite3D rotation={rotation} onRotationChange={setRotation} onInteraction={handleInteraction} anomalyState={anomalyState} />
                <OrbitControls enableRotate={false} enablePan={false} enableZoom minDistance={4.5} maxDistance={8.5} />
              </Canvas>
              <div className="canvas-overlay overlay-top"><span>TRACKING / ODY-01</span><span>EARTH · NORTH ATLANTIC</span></div>
              <div className="canvas-overlay overlay-bottom"><span className="crosshair">＋</span><span>LEFT DRAG: PITCH / YAW &nbsp; RIGHT DRAG: ROLL</span></div>
            </div>
            <div className="attitude-strip"><div className="attitude-meter"><span>ROTATION LOAD</span><div className="meter-track"><div className="meter-fill" style={{ width: `${Math.min(100, agitation)}%` }} /></div><strong>{agitation.toFixed(0)}%</strong></div><div className="attitude-readout"><span>GYRO VECTOR</span><strong>{telemetry.gyroX.toFixed(2)} / {telemetry.gyroY.toFixed(2)} / {telemetry.gyroZ.toFixed(2)}</strong></div></div>
          </div>
        </section>

        <section className="section-block telemetry-block">
          <div className="section-header"><div><span className="panel-kicker">DOWNLINK STREAM / 01</span><h3>Telemetry overview</h3></div><div className="stream-status"><span className="stream-dot" />LIVE STREAM · 1.5 SEC</div></div>
          <div className="telemetry-layout">
            <div className="metric-grid">
              <TelemetryCard label="Battery voltage" value={telemetry.batteryVoltage.toFixed(2)} unit="V" icon="▣" tone={telemetry.batteryVoltage < 6.5 ? "rose" : "cyan"} />
              <TelemetryCard label="Battery current" value={telemetry.batteryCurrent.toFixed(2)} unit="A" icon="↯" tone="violet" />
              <TelemetryCard label="Solar power" value={telemetry.solarPower.toFixed(2)} unit="W" icon="☼" tone="amber" />
              <TelemetryCard label="CPU temperature" value={telemetry.temperature.toFixed(1)} unit="°C" icon="◌" tone={telemetry.temperature > 70 ? "rose" : "amber"} />
              <TelemetryCard label="Signal strength" value={telemetry.signalStrength.toFixed(0)} unit="dBm" icon="⌁" tone="cyan" />
              <TelemetryCard label="Packet loss" value={telemetry.packetLoss.toFixed(1)} unit="%" icon="⋮" tone={telemetry.packetLoss > 20 ? "rose" : "mint"} />
            </div>
            <div className="chart-card"><div className="chart-title"><span>THERMAL ENVELOPE</span><strong>{telemetry.temperature.toFixed(1)}°C</strong></div><TelemetryChart values={history} alert={telemetry.temperature > 70} /><div className="chart-axis"><span>−12s</span><span>NOW</span></div></div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="section-block subsystem-block"><div className="section-header compact"><div><span className="panel-kicker">SUBSYSTEM HEALTH</span><h3>Mission systems</h3></div><span className={`mini-status ${isAlert ? "alert" : "nominal"}`}>{isAlert ? "ATTENTION" : "NOMINAL"}</span></div><div className="subsystem-grid"><SubsystemCard name="Power" detail="BUS & GENERATION" value={telemetry.batteryVoltage < 6.5 ? "DEGRADED" : "NOMINAL"} tone={telemetry.batteryVoltage < 6.5 ? "rose" : "mint"} icon="◒" /><SubsystemCard name="Thermal" detail="CPU / PAYLOAD" value={telemetry.temperature > 70 ? "CRITICAL" : "NOMINAL"} tone={telemetry.temperature > 70 ? "rose" : "amber"} icon="◉" /><SubsystemCard name="Comms" detail="S-BAND DOWNLINK" value={telemetry.packetLoss > 20 ? "DEGRADED" : "NOMINAL"} tone={telemetry.packetLoss > 20 ? "rose" : "cyan"} icon="◌" /><SubsystemCard name="Attitude" detail="ADCS / GYROS" value={subsystem === "Attitude" ? "UNSTABLE" : "NOMINAL"} tone={subsystem === "Attitude" ? "rose" : "violet"} icon="✧" /></div></div>
          <div className="section-block advisor-block"><div className="section-header compact"><div><span className="panel-kicker">MISSION ADVISOR / RULE ENGINE</span><h3>Response brief</h3></div><span className={`severity-tag ${severity}`}>{severity === "none" ? "CLEAR" : severity.toUpperCase()}</span></div><div className="advisor-content"><div className="advisor-orb">{isAlert ? "!" : "✓"}</div><div><p className="advisor-heading">{isAlert ? `${subsystem} subsystem requires attention` : "Spacecraft is tracking nominally"}</p><p className="advisor-copy">{analysis.alert?.summary || "Awaiting first telemetry packet from the simulator."}</p>{analysis.alert?.actions?.length > 0 && <div className="action-list">{analysis.alert.actions.slice(0, 2).map((action) => <span key={action}>→ {action}</span>)}</div>}</div></div></div>
        </section>

        <section className="section-block command-block"><div className="section-header compact"><div><span className="panel-kicker">SIMULATION CONTROL / OPERATOR INPUT</span><h3>Inject a scenario</h3></div><span className="command-note">Packets are sent to the existing FastAPI backend</span></div><div className="fault-controls">{FAULTS.map((fault) => <button key={fault.id} className={`fault-button ${fault.accent} ${anomalyState === fault.anomalyState ? "selected" : ""}`} onClick={() => { setSelectedFault(fault.id); setAnomalyState(fault.anomalyState); }}><span className="fault-icon">{fault.id === "normal" ? "✓" : fault.id === "thermal" ? "◉" : fault.id === "power" ? "↯" : fault.id === "communication" ? "⌁" : "✧"}</span><span><strong>{fault.shortLabel}</strong><small>{fault.hint}</small></span><span className="selection-mark">{anomalyState === fault.anomalyState ? "ACTIVE" : ""}</span></button>)}</div><div className="command-footer"><span className="backend-message">{lastError || (apiState === "online" ? "Backend link healthy · POST /telemetry" : "Local fallback active · connect FastAPI on port 8000")}</span><span className="scenario-readout">VISUAL STATE <strong>{anomalyState.toUpperCase()}</strong></span></div></section>
      </main>
      <footer className="footer"><span>ODYSSEY 01 · CUBESAT TELEMETRY SIMULATOR</span><span>FASTAPI LINK <i className={apiState} /> · BUILD 0.4.2</span></footer>
    </div>
  );
}

function TelemetryCard({ label, value, unit, icon, tone }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}<small>{unit}</small></strong></div><div className={`metric-line ${tone}`} /></div>;
}

function SubsystemCard({ name, detail, value, tone, icon }) {
  return <div className="subsystem-card"><div className={`subsystem-icon ${tone}`}>{icon}</div><div><strong>{name}</strong><span>{detail}</span></div><b className={tone}>{value}</b></div>;
}

function TelemetryChart({ values, alert }) {
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - MathUtils.clamp((value - 25) / 65, 0, 1) * 75 - 10}`).join(" ");
  return <svg className={`telemetry-chart ${alert ? "alert" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Temperature history chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#55ddca" stopOpacity="0.34" /><stop offset="1" stopColor="#55ddca" stopOpacity="0" /></linearGradient></defs><path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#chartFill)" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}

export default App;
