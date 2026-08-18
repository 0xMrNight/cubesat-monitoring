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

function createTelemetry(faults, agitation) {
  const activeFaults = Array.isArray(faults)
    ? faults.filter((fault) => fault !== "normal")
    : faults && faults !== "normal" ? [faults] : [];
  const hasFault = (fault) => activeFaults.includes(fault);
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

  if (hasFault("thermal")) {
    packet.temperature = randomBetween(82, 2.5);
  }
  if (hasFault("power")) {
    packet.battery_voltage = randomBetween(5.8, 0.1);
    packet.battery_current = randomBetween(2.8, 0.2);
    packet.solar_power = Math.max(0, randomBetween(0.4, 0.1));
  }
  if (hasFault("communication")) {
    packet.signal_strength = randomBetween(-104, 3);
    packet.packet_loss = randomBetween(38, 5);
  }
  if (hasFault("attitude")) {
    packet.gyro_x = randomBetween(2.3, 0.3);
    packet.gyro_y = randomBetween(-1.8, 0.3);
    packet.gyro_z = randomBetween(1.5, 0.3);
  }
  return packet;
}

function scenarioVisualState(faults) {
  const activeFaults = Array.isArray(faults) ? faults : [faults];
  if (activeFaults.includes("thermal")) return "overheating";
  if (activeFaults.includes("communication")) return "signal_loss";
  if (activeFaults.includes("attitude")) return "unstable_motion";
  if (activeFaults.includes("power")) return "power_failure";
  return "normal";
}

function historyPoint(packet) {
  return {
    temperature: packet.temperature,
    batteryVoltage: packet.battery_voltage,
    solarPower: packet.solar_power,
    signalStrength: packet.signal_strength,
    packetLoss: packet.packet_loss,
  };
}

function prettySubsystem(value) {
  return String(value || "unknown").replace(/_/g, " ").toUpperCase();
}

function createLocalAnalysis(packet) {
  const anomalies = [];
  if (packet.temperature > 70) anomalies.push({ metric: "temperature", value: packet.temperature, severity: "critical", recommended_action: "Enter thermal-safe mode" });
  if (packet.battery_voltage < 6.5) anomalies.push({ metric: "battery_voltage", value: packet.battery_voltage, severity: "critical", recommended_action: "Reduce non-essential loads" });
  if (packet.signal_strength < -90 || packet.packet_loss > 20) anomalies.push({ metric: "signal_strength", value: packet.signal_strength, severity: "warning", recommended_action: "Reacquire ground station link" });
  if (Math.max(Math.abs(packet.gyro_x), Math.abs(packet.gyro_y), Math.abs(packet.gyro_z)) > 1) anomalies.push({ metric: "gyro_x", value: packet.gyro_x, severity: "critical", recommended_action: "Switch to attitude-safe mode" });

  const localReasons = anomalies.map((item) => {
    if (item.metric === "temperature") return `Temperature is high (${packet.temperature.toFixed(2)} °C).`;
    if (item.metric === "battery_voltage") return `Battery voltage is low (${packet.battery_voltage.toFixed(2)} V).`;
    if (item.metric === "signal_strength") return `Signal strength or packet loss is outside the configured limit (${packet.signal_strength.toFixed(2)} dBm, ${packet.packet_loss.toFixed(2)}%).`;
    if (item.metric === "gyro_x") return `Attitude telemetry is unstable (gyro vector ${packet.gyro_x.toFixed(2)} / ${packet.gyro_y.toFixed(2)} / ${packet.gyro_z.toFixed(2)}).`;
    return `Telemetry metric ${item.metric} is outside the configured limit.`;
  });
  const localReason = localReasons.join(" ");

  return {
    anomaly_count: anomalies.length,
    anomalies,
    ml: { model_status: "local_fallback", is_anomaly: anomalies.length > 0, score: anomalies.length ? -0.82 : 0.04 },
    alert: {
      status: anomalies.length ? "alert" : "nominal",
      priority: anomalies.some((item) => item.severity === "critical") ? "critical" : anomalies.length ? "warning" : "none",
      actions: [...new Set(anomalies.map((item) => item.recommended_action))],
      reason: localReason || "All monitored values are within configured limits.",
      summary: localReason || "All monitored values are within configured limits.",
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

async function analyzeTelemetry(telemetry) {
  // One backend call owns ingestion, rolling-feature updates, diagnosis, and
  // the Mission Agent response. Do not send the same packet twice.
  const telemetryResponse = await fetch(`${API_BASE}/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(telemetry),
  });

  if (!telemetryResponse.ok) {
    throw new Error(`Telemetry API ${telemetryResponse.status}`);
  }

  const payload = await telemetryResponse.json();
  const analysis = payload.analysis || {};

  return {
    analysis,
    agent: analysis.agent || payload.agent || null,
  };
}


/*
 * Converts the new backend response into the shape
 * expected by the existing dashboard components.
 */
function flattenText(value) {
  if (Array.isArray(value)) return value.flatMap((item) => flattenText(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => flattenText(item));
  return value == null || value === "" ? [] : [String(value)];
}

function normalizeBackendAnalysis(result) {
  const analysis = result?.analysis || {};
  const nestedDiagnosis = analysis?.diagnosis || {};
  // The current backend returns diagnosis fields directly on analysis;
  // older responses nested them under analysis.diagnosis. Support both.
  const diagnosis = {
    ...analysis,
    ...nestedDiagnosis,
    subsystem: nestedDiagnosis.subsystem ?? analysis.subsystem ?? null,
    affected_subsystems: nestedDiagnosis.affected_subsystems ?? analysis.affected_subsystems ?? [],
    severity: nestedDiagnosis.severity ?? analysis.severity ?? "normal",
    confidence: nestedDiagnosis.confidence ?? analysis.confidence ?? 0,
    evidence: nestedDiagnosis.evidence ?? analysis.evidence ?? {},
    reasons: nestedDiagnosis.reasons ?? analysis.reasons ?? {},
    recommended_actions: nestedDiagnosis.recommended_actions ?? analysis.recommended_actions ?? [],
  };
  const agent = result?.agent || analysis?.agent || null;

  const anomaly = Boolean(analysis.anomaly);

  const reasons = flattenText(diagnosis.reasons);
  const evidence = flattenText(diagnosis.evidence);

  /*
   * The backend may return different field names for the
   * Mission Agent response. Support the common possibilities
   * without coupling the UI too tightly to the agent.
   */
  const agentSummary =
    agent?.reason ||
    agent?.explanation ||
    agent?.summary ||
    agent?.reasoning ||
    agent?.message ||
    "";

  const agentRecommendation = agent?.recommendation || "";

  const agentActions = Array.isArray(agent?.actions)
    ? agent.actions
    : agent?.actions
      ? [agent.actions]
      : [];

  const actions = [
    ...agentActions,
    ...(agentRecommendation ? [agentRecommendation] : []),
    ...flattenText(diagnosis.recommended_actions),
  ];

  const allReasons = [...reasons, ...evidence];

  const anomalies = anomaly
    ? [
      {
        metric: diagnosis.subsystem || "telemetry",
        value: analysis.anomaly_score,
        severity: diagnosis.severity || "warning",
        recommended_action:
          actions[0] || "Follow Mission Agent recommendation",
        reasons: allReasons,
      },
    ]
    : [];

  const severity = diagnosis.severity || (anomaly ? "warning" : "none");

  return {
    anomaly_count: anomaly ? 1 : 0,

    anomalies,

    /*
     * Keep the raw backend response available.
     * This is useful if you later want to display
     * confidence, evidence, anomaly score, etc.
     */
    backend: {
      analysis,
      diagnosis,
      agent,
    },

    ml: {
      model_status: "backend",
      is_anomaly: anomaly,
      score: analysis.anomaly_score ?? 0,
    },

    alert: {
      status: anomaly ? "alert" : "nominal",
      priority: anomaly ? severity : "none",
      actions: [...new Set(actions)],
      recommendation: agentRecommendation || null,
      reason:
        agentSummary ||
        reasons[0] ||
        (anomaly
          ? "The telemetry is outside the configured operating limits, but the agent did not return an explanation."
          : "All monitored values are within configured limits."),
      summary:
        agentSummary ||
        reasons[0] ||
        (anomaly
          ? "Anomaly detected in spacecraft telemetry."
          : "All monitored values are within configured limits."),
    },
  };
}


/*
 * Convert the authoritative backend diagnosis into
 * one of the visual states used by Satellite3D.
 */
function inferBackendAnomalyState(analysis) {
  if (!analysis?.anomaly) {
    return "normal";
  }

  const diagnosis = analysis.diagnosis || analysis || {};

  const subsystem = String(
    diagnosis.subsystem || ""
  ).toLowerCase();

  const affected = (
    Array.isArray(diagnosis.affected_subsystems)
      ? diagnosis.affected_subsystems
      : []
  )
    .map((value) => String(value).toLowerCase())
    .join(" ");

  const combined = `${subsystem} ${affected}`;

  if (
    combined.includes("thermal") ||
    combined.includes("temperature")
  ) {
    return "overheating";
  }

  if (
    combined.includes("communication") ||
    combined.includes("comms") ||
    combined.includes("signal")
  ) {
    return "signal_loss";
  }

  if (
    combined.includes("attitude") ||
    combined.includes("adcs") ||
    combined.includes("gyro")
  ) {
    return "unstable_motion";
  }

  if (
    combined.includes("power") ||
    combined.includes("battery") ||
    combined.includes("solar")
  ) {
    return "power_failure";
  }

  return "normal";
}

function getAnomalyEpisodeKey(analysis, visualState) {
  if (!analysis?.anomaly_count) return "normal";
  const diagnosis = analysis.backend?.diagnosis || {};
  const affected = Array.isArray(diagnosis.affected_subsystems)
    ? [...diagnosis.affected_subsystems].sort().join(",")
    : "";
  return [visualState, diagnosis.subsystem || "unknown", diagnosis.severity || "warning", affected].join("|");
}

function getRuleReason(analysis) {
  return analysis?.alert?.reason || analysis?.alert?.summary || "Anomaly detected in spacecraft telemetry.";
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
  const [selectedFaults, setSelectedFaults] = useState(["normal"]);
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
  const [history, setHistory] = useState([
    { temperature: 34.2, batteryVoltage: 8.1, solarPower: 20.0, signalStrength: -70, packetLoss: 0.5 },
    { temperature: 34.4, batteryVoltage: 8.08, solarPower: 19.8, signalStrength: -71, packetLoss: 0.6 },
    { temperature: 34.1, batteryVoltage: 8.12, solarPower: 20.1, signalStrength: -69, packetLoss: 0.4 },
    { temperature: 34.6, batteryVoltage: 8.09, solarPower: 19.9, signalStrength: -70, packetLoss: 0.7 },
    { temperature: 34.2, batteryVoltage: 8.1, solarPower: 20.0, signalStrength: -70, packetLoss: 0.5 },
  ]);
  const [apiState, setApiState] = useState("connecting");
  const [lastSent, setLastSent] = useState(null);
  const [packetCount, setPacketCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const [ruleReason, setRuleReason] = useState("");
  const [ruleEpisodeKey, setRuleEpisodeKey] = useState("normal");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentGuidance, setAgentGuidance] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const [rawTelemetryOpen, setRawTelemetryOpen] = useState(false);
  const sendLock = useRef(false);
  const sendTelemetryRef = useRef(null);
  const requestTokenRef = useRef(0);
  const queuedFaultRef = useRef(null);
  const ruleEpisodeKeyRef = useRef("normal");
  const ruleReasonRef = useRef("");

  const isAlert = analysis.anomaly_count > 0;
  const diagnosis = analysis.backend?.diagnosis || {};
  const backendAffectedSubsystems = Array.isArray(diagnosis.affected_subsystems)
    ? diagnosis.affected_subsystems
    : [];
  const affectedSubsystems = backendAffectedSubsystems.length
    ? backendAffectedSubsystems
    : (analysis.anomalies || []).map((item) => {
      if (item.metric === "temperature") return "thermal";
      if (["battery_voltage", "battery_current", "solar_power"].includes(item.metric)) return "power";
      if (["signal_strength", "packet_loss"].includes(item.metric)) return "communication";
      return "attitude";
    });
  const rawSubsystem =
    diagnosis.subsystem ||
    affectedSubsystems[0] ||
    getSubsystem(analysis.anomalies || []);

  const subsystem =
    !rawSubsystem ||
      rawSubsystem.toLowerCase() === "unknown" ||
      rawSubsystem.toLowerCase() === "all systems"
      ? "Unclassified"
      : rawSubsystem;
  const severity = analysis.alert?.priority || "none";
  const affectedSet = new Set(affectedSubsystems.map((item) => String(item).toLowerCase()));
  const evidence = diagnosis.evidence || {};
  const evidenceReasons = diagnosis.reasons || {};
  const subsystemStatus = (key) => {
    if (!affectedSet.has(key)) return "NOMINAL";
    if (key === "attitude") return severity === "critical" ? "UNSTABLE" : "DEGRADED";
    return severity === "critical" ? "CRITICAL" : "DEGRADED";
  };
  const subsystemTone = (status) => status === "NOMINAL" ? "mint" : status === "DEGRADED" ? "amber" : "rose";

  const handleInteraction = useCallback((intensity) => {
    setAgitation((value) => Math.min(100, value * 0.88 + intensity * 0.9));
  }, []);

  const sendTelemetry = useCallback(async (faultOverride = selectedFaults) => {
    if (sendLock.current) {
      queuedFaultRef.current = faultOverride;
      return;
    }

    sendLock.current = true;
    const requestToken = ++requestTokenRef.current;

    const packet = createTelemetry(faultOverride, agitation);

    let nextAnalysis = createLocalAnalysis(packet);
    let nextAnomalyState;

    try {
      // One request handles telemetry ingestion, diagnosis, and the agent.
      const result = await analyzeTelemetry(packet);

      /*
       * ---------------------------------------------------------
       * STEP 3 — Convert backend response into dashboard format
       * ---------------------------------------------------------
       */
      nextAnalysis = normalizeBackendAnalysis(result);

      /*
       * ---------------------------------------------------------
       * STEP 4 — Use backend diagnosis as the authoritative
       * source for the visual satellite state.
       * ---------------------------------------------------------
       */
      nextAnomalyState = inferBackendAnomalyState(result.analysis);

      if (requestToken === requestTokenRef.current) {
        setAnomalyState(nextAnomalyState);
        setApiState("online");
        setLastError("");
      }
    } catch (error) {
      console.error("Telemetry pipeline failed:", error);

      /*
       * Backend unavailable:
       * keep the dashboard functional using local analysis.
       */
      nextAnalysis = createLocalAnalysis(packet);

      nextAnomalyState = inferAnomalyState(nextAnalysis);

      if (requestToken === requestTokenRef.current) {
        setAnomalyState(nextAnomalyState);
        setApiState("offline");
        setLastError("Backend unavailable — local simulation continues");
      }
    } finally {
      /*
       * Only the newest request may commit results to the dashboard.
       * This prevents a normal packet already in flight from overwriting
       * the anomaly the operator just injected.
       */
      if (requestToken === requestTokenRef.current) {
        const nextEpisodeKey = getAnomalyEpisodeKey(nextAnalysis, nextAnomalyState);
        const episodeChanged = nextEpisodeKey !== ruleEpisodeKeyRef.current;

        if (episodeChanged) {
          const episodeDiagnosis = nextAnalysis.backend?.diagnosis || {};
          setEventHistory((events) => [{
            id: `${Date.now()}-${nextEpisodeKey}`,
            timestamp: new Date(),
            severity: nextEpisodeKey === "normal" ? "normal" : (episodeDiagnosis.severity || nextAnalysis.alert?.priority || "warning"),
            subsystem: nextEpisodeKey === "normal" ? "all systems" : (episodeDiagnosis.subsystem || nextAnomalyState),
          }, ...events].slice(0, 8));
        }

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
        setHistory((values) => [...values.slice(-11), historyPoint(packet)]);
        setPacketCount((value) => value + 1);
        setLastSent(new Date());

        if (episodeChanged || nextEpisodeKey === "normal") {
          const nextReason = nextEpisodeKey === "normal" ? "" : getRuleReason(nextAnalysis);
          ruleEpisodeKeyRef.current = nextEpisodeKey;
          ruleReasonRef.current = nextReason;
          setRuleEpisodeKey(nextEpisodeKey);
          setRuleReason(nextReason);
        }
      }

      sendLock.current = false;
      const queuedFault = queuedFaultRef.current;
      queuedFaultRef.current = null;
      if (queuedFault) window.setTimeout(() => sendTelemetryRef.current?.(queuedFault), 0);
    }
  }, [agitation, selectedFaults]);

  useEffect(() => {
    sendTelemetryRef.current = sendTelemetry;
  }, [sendTelemetry]);

  const handleFaultSelect = useCallback((fault) => {
    requestTokenRef.current += 1;
    const currentFaults = selectedFaults.filter((item) => item !== "normal");
    const nextFaults = fault.id === "normal"
      ? ["normal"]
      : currentFaults.includes(fault.id)
        ? currentFaults.filter((item) => item !== fault.id)
        : [...currentFaults, fault.id];
    const normalizedFaults = nextFaults.length ? nextFaults : ["normal"];
    const nextVisualState = scenarioVisualState(normalizedFaults);
    const previewPacket = createTelemetry(normalizedFaults, agitation);
    const previewAnalysis = createLocalAnalysis(previewPacket);
    const previewEpisodeKey = getAnomalyEpisodeKey(previewAnalysis, nextVisualState);
    const previewReason = normalizedFaults.includes("normal") ? "" : getRuleReason(previewAnalysis);

    setSelectedFaults(normalizedFaults);
    setAnomalyState(nextVisualState);
    setAnalysis(previewAnalysis);
    ruleEpisodeKeyRef.current = previewEpisodeKey;
    ruleReasonRef.current = previewReason;
    setRuleEpisodeKey(previewEpisodeKey);
    setRuleReason(previewReason);
    setAgentOpen(false);
    setAgentGuidance(null);
    setAgentError("");
    void sendTelemetry(normalizedFaults);
  }, [agitation, selectedFaults, sendTelemetry]);

  const handleAskAgent = useCallback(async () => {
    if (!isAlert || agentLoading) return;
    setAgentOpen(true);
    setAgentLoading(true);
    setAgentError("");

    const diagnosis = analysis.backend?.diagnosis || {};
    const primarySubsystem = diagnosis.subsystem || String(subsystem).toLowerCase();
    const affectedSubsystems = diagnosis.affected_subsystems?.length
      ? diagnosis.affected_subsystems
      : [primarySubsystem];
    const reasons = diagnosis.reasons || { [primarySubsystem]: [ruleReasonRef.current] };

    try {
      const response = await fetch(`${API_BASE}/agent/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomaly: true,
          anomaly_score: analysis.ml?.score ?? 0,
          subsystem: primarySubsystem,
          affected_subsystems: affectedSubsystems,
          severity: diagnosis.severity || severity,
          confidence: diagnosis.confidence ?? 0,
          evidence: diagnosis.evidence || {},
          reasons,
          temperature: telemetry.temperature,
          battery_voltage: telemetry.batteryVoltage,
          battery_current: telemetry.batteryCurrent,
          solar_power: telemetry.solarPower,
          signal_strength: telemetry.signalStrength,
          packet_loss: telemetry.packetLoss,
          gyro_x: telemetry.gyroX,
          gyro_y: telemetry.gyroY,
          gyro_z: telemetry.gyroZ,
        }),
      });
      if (!response.ok) throw new Error(`Agent API ${response.status}`);
      const payload = await response.json();
      setAgentGuidance(payload);
    } catch (error) {
      setAgentError(error.message || "Mission Agent unavailable");
    } finally {
      setAgentLoading(false);
    }
  }, [agentLoading, analysis, isAlert, severity, subsystem, telemetry]);

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
    const initialTimer = window.setTimeout(() => sendTelemetryRef.current?.(), 0);
    const timer = window.setInterval(() => sendTelemetryRef.current?.(), SEND_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

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
          <div className={`connection-pill ${apiState}`}><span className="status-pulse" />{apiState === "online" ? "BACKEND CONNECTED" : apiState === "connecting" ? "BACKEND CONNECTING" : "BACKEND OFFLINE"}</div>
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
              <TelemetryCard label="Gyro X" value={telemetry.gyroX.toFixed(2)} unit="rad/s" icon="✧" tone="violet" />
              <TelemetryCard label="Gyro Y" value={telemetry.gyroY.toFixed(2)} unit="rad/s" icon="✧" tone="violet" />
              <TelemetryCard label="Gyro Z" value={telemetry.gyroZ.toFixed(2)} unit="rad/s" icon="✧" tone="violet" />
            </div>
            <div className="chart-grid">
              <TelemetryChart label="Temperature" field="temperature" values={history} min={20} max={90} unit="°C" alert={telemetry.temperature > 70} />
              <TelemetryChart label="Battery voltage" field="batteryVoltage" values={history} min={5} max={9} unit="V" alert={telemetry.batteryVoltage < 6.5} />
              <TelemetryChart label="Solar power" field="solarPower" values={history} min={0} max={22} unit="W" alert={telemetry.solarPower < 5} />
              <TelemetryChart label="Signal strength" field="signalStrength" values={history} min={-110} max={-50} unit="dBm" alert={telemetry.signalStrength < -90} />
            </div>
          </div>
        </section>

        <section className="diagnostic-grid">
          <div className="section-block anomaly-details-block">
            <div className="section-header compact"><div><span className="panel-kicker">ANOMALY DIAGNOSTICS</span><h3>{isAlert ? "Anomaly detected" : "System diagnosis"}</h3></div><span className={`severity-tag ${severity}`}>{isAlert ? (diagnosis.severity || severity).toUpperCase() : "CLEAR"}</span></div>
            {isAlert ? (
              <div className="detail-matrix">
                <div><span>PRIMARY SUBSYSTEM</span><strong>{prettySubsystem(diagnosis.subsystem || subsystem)}</strong></div>
                <div><span>AFFECTED SUBSYSTEMS</span><strong>{affectedSubsystems.length ? affectedSubsystems.map(prettySubsystem).join(" • ") : "NONE"}</strong></div>
                <div><span>SEVERITY</span><strong>{prettySubsystem(diagnosis.severity || severity)}</strong></div>
                <div><span>CONFIDENCE</span><strong>{diagnosis.confidence != null ? `${(Number(diagnosis.confidence) * 100).toFixed(0)}%` : "--"}</strong></div>
              </div>
            ) : <p className="empty-diagnostic">No active anomaly. Backend diagnosis fields will appear here when the rule engine reports one.</p>}
          </div>
          <div className="section-block evidence-block">
            <div className="section-header compact"><div><span className="panel-kicker">EVIDENCE / RULE ENGINE</span><h3>Why?</h3></div><span className="mini-status">{Object.keys(evidence).length ? "EXPLAINABLE" : "AWAITING"}</span></div>
            <div className="evidence-values">{Object.entries(evidence).length ? Object.entries(evidence).map(([key, value]) => <div key={key}><span>{prettySubsystem(key)}</span><strong>{Number(value).toFixed(2)}</strong></div>) : <p className="empty-diagnostic">No evidence values reported.</p>}</div>
            <div className="evidence-reasons">{Object.entries(evidenceReasons).filter(([, reasons]) => flattenText(reasons).length).map(([key, reasons]) => <div key={key}><span>{prettySubsystem(key)}</span>{flattenText(reasons).map((reason, index) => <p key={`${key}-${index}`}>• {reason}</p>)}</div>)}</div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="section-block subsystem-block"><div className="section-header compact"><div><span className="panel-kicker">SUBSYSTEM HEALTH</span><h3>Mission systems</h3></div><span className={`mini-status ${isAlert ? "alert" : "nominal"}`}>{isAlert ? "ATTENTION" : "NOMINAL"}</span></div><div className="subsystem-grid"><SubsystemCard name="Power" detail="BUS & GENERATION" value={subsystemStatus("power")} tone={subsystemTone(subsystemStatus("power"))} icon="◒" /><SubsystemCard name="Thermal" detail="CPU / PAYLOAD" value={subsystemStatus("thermal")} tone={subsystemTone(subsystemStatus("thermal"))} icon="◉" /><SubsystemCard name="Comms" detail="S-BAND DOWNLINK" value={subsystemStatus("communication")} tone={subsystemTone(subsystemStatus("communication"))} icon="◌" /><SubsystemCard name="Attitude" detail="ADCS / GYROS" value={subsystemStatus("attitude")} tone={subsystemTone(subsystemStatus("attitude"))} icon="✧" /></div></div>
          <div className="section-block advisor-block"><div className="section-header compact"><div><span className="panel-kicker">RULE ENGINE / LATCHED DIAGNOSIS</span><h3>Rule reason</h3></div><span className={`severity-tag ${severity}`}>{severity === "none" ? "CLEAR" : severity.toUpperCase()}</span><span className="episode-tag">{ruleEpisodeKey === "normal" ? "MONITORING" : "LATCHED"}</span></div>
            <div className="advisor-content">
              <div className="advisor-orb">
                {isAlert ? "!" : "✓"}
              </div>

              <div>
                <p className="advisor-heading">
                  {isAlert
                    ? `${subsystem} anomaly detected`
                    : "Spacecraft is tracking nominally"}
                </p>

                <p className="advisor-copy">
                  {isAlert
                    ? (ruleReason || getRuleReason(analysis))
                    : "No active anomaly. Rule-engine reason will latch when a new anomaly episode begins."}
                </p>

                {isAlert && (
                  <button className="agent-ask-button" type="button" onClick={handleAskAgent} disabled={agentLoading}>
                    {agentLoading ? "MISSION AGENT THINKING..." : "ASK MISSION AGENT: HOW DO I SOLVE THIS?"}
                  </button>
                )}

                {isAlert &&
                  analysis.backend?.diagnosis?.confidence != null && (
                    <div className="advisor-confidence">
                      CONFIDENCE{" "}
                      <strong>
                        {(
                          Number(analysis.backend.diagnosis.confidence) * 100
                        ).toFixed(0)}
                        %
                      </strong>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </section>

        {agentOpen && (
          <div className="agent-modal-backdrop" role="presentation" onClick={() => setAgentOpen(false)}>
            <section className="agent-modal" role="dialog" aria-modal="true" aria-labelledby="agent-modal-title" onClick={(event) => event.stopPropagation()}>
              <div className="agent-modal-header">
                <div><span className="panel-kicker">MISSION AGENT / ON DEMAND</span><h3 id="agent-modal-title">How do I solve this?</h3></div>
                <button className="agent-close-button" type="button" onClick={() => setAgentOpen(false)}>CLOSE</button>
              </div>
              <p className="agent-modal-context"><strong>Latched rule reason:</strong> {ruleReason || "Current anomaly evidence is being prepared."}</p>
              {agentLoading && <p className="agent-loading">The agent is preparing a conservative response from the current telemetry and rule-engine evidence...</p>}
              {agentError && <p className="agent-error">{agentError}</p>}
              {agentGuidance && (
                <div className="agent-guidance">
                  <div><span className="panel-kicker">AGENT EXPLANATION</span><p>{agentGuidance.reason || agentGuidance.explanation || "No explanation returned."}</p></div>
                  <div><span className="panel-kicker">RECOMMENDATION</span><p>{agentGuidance.recommendation || "No recommendation returned."}</p></div>
                  <span className="agent-provider">PROVIDER / {(agentGuidance.provider || "agent").toUpperCase()}</span>
                </div>
              )}
            </section>
          </div>
        )}

        <section className="section-block command-block"><div className="section-header compact"><div><span className="panel-kicker">SIMULATION CONTROL / OPERATOR INPUT</span><h3>Inject a scenario</h3></div><span className="command-note">Toggle any combination · packets are sent to the existing FastAPI backend</span></div><div className="fault-controls">{FAULTS.map((fault) =>
          <button
            key={fault.id}
            className={`fault-button ${fault.accent} ${selectedFaults.includes(fault.id) ? "selected" : ""}`}
            onClick={() => handleFaultSelect(fault)}
            aria-pressed={selectedFaults.includes(fault.id)}
          >
            <span className="fault-icon">{fault.id === "normal" ? "✓" : fault.id === "thermal" ? "◉" : fault.id === "power" ? "↯" : fault.id === "communication" ? "⌁" : "✧"}</span><span><strong>{fault.shortLabel}</strong><small>{fault.hint}</small></span><span className="selection-mark">{selectedFaults.includes(fault.id) ? "ACTIVE" : ""}</span></button>)}</div><div className="command-footer">
            <span className="backend-message">
              {lastError ||
                (apiState === "online"
                  ? "Backend link healthy · telemetry → anomaly engine · agent on demand"
                  : "Local fallback active · connect FastAPI on port 8000")}
            </span>
              <span className="scenario-readout">SELECTED <strong>{selectedFaults.filter((item) => item !== "normal").map((item) => item.toUpperCase()).join(" + ") || "NORMAL"}</strong></span>
            </div></section>
        <section className="history-raw-grid">
          <div className="section-block event-block">
            <div className="section-header compact"><div><span className="panel-kicker">EVENT STREAM</span><h3>Recent events</h3></div><span className="mini-status">{eventHistory.length ? `${eventHistory.length} RECORDED` : "NO EVENTS"}</span></div>
            <div className="event-list">{eventHistory.length ? eventHistory.map((event) => <div className="event-row" key={event.id}><span>{event.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><b className={event.severity}>{event.severity.toUpperCase()}</b><strong>{prettySubsystem(event.subsystem)}</strong></div>) : <p className="empty-diagnostic">Anomaly transitions will appear here as the backend reports them.</p>}</div>
          </div>
          <div className="section-block raw-block">
            <div className="section-header compact"><div><span className="panel-kicker">DIAGNOSTIC VIEW</span><h3>Raw telemetry</h3></div><button className="raw-toggle" type="button" onClick={() => setRawTelemetryOpen((value) => !value)}>{rawTelemetryOpen ? "HIDE RAW" : "VIEW RAW"}</button></div>
            {rawTelemetryOpen && <div className="raw-grid"><span>timestamp</span><strong>{lastSent?.toISOString() || "--"}</strong><span>battery_voltage</span><strong>{telemetry.batteryVoltage.toFixed(2)}</strong><span>battery_current</span><strong>{telemetry.batteryCurrent.toFixed(2)}</strong><span>solar_power</span><strong>{telemetry.solarPower.toFixed(2)}</strong><span>temperature</span><strong>{telemetry.temperature.toFixed(2)}</strong><span>signal_strength</span><strong>{telemetry.signalStrength.toFixed(2)}</strong><span>packet_loss</span><strong>{telemetry.packetLoss.toFixed(2)}</strong><span>gyro_x</span><strong>{telemetry.gyroX.toFixed(2)}</strong><span>gyro_y</span><strong>{telemetry.gyroY.toFixed(2)}</strong><span>gyro_z</span><strong>{telemetry.gyroZ.toFixed(2)}</strong></div>}
          </div>
        </section>
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

function TelemetryChart({ label, field, values, min, max, unit, alert }) {
  const current = values.at(-1)?.[field] ?? min;
  const points = values.map((entry, index) => {
    const normalized = MathUtils.clamp((Number(entry[field]) - min) / (max - min), 0, 1);
    return `${(index / Math.max(values.length - 1, 1)) * 100},${100 - normalized * 76 - 8}`;
  }).join(" ");
  const gradientId = `chartFill-${field}`;
  return <div className={`chart-card mini-chart ${alert ? "alert" : ""}`}><div className="chart-title"><span>{label.toUpperCase()}</span><strong>{Number(current).toFixed(field === "signalStrength" ? 0 : 1)}{unit}</strong></div><svg className="telemetry-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label} history chart`}><defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#55ddca" stopOpacity="0.34" /><stop offset="1" stopColor="#55ddca" stopOpacity="0" /></linearGradient></defs><path d={`M 0,100 L ${points} L 100,100 Z`} fill={`url(#${gradientId})`} /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg><div className="chart-axis"><span>−18s</span><span>NOW</span></div></div>;
}

export default App;
