import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";

const OVERHEAT = "overheating";
const SIGNAL_LOSS = "signal_loss";
const UNSTABLE = "unstable_motion";
const POWER_FAILURE = "power_failure";

function seeded(index, salt = 1) {
  return ((index * 9301 + salt * 49297) % 233280) / 233280;
}

function makeRefs(count) {
  return Array.from({ length: count }, () => ({ current: null }));
}

export default function AnomalyEffects({ anomalyState = "normal", model }) {
  const heatLight = useRef(null);
  const warningLight = useRef(null);
  const antennaVisual = useRef(null);
  const wobbleStrength = useRef(0);
  const safeTiltStrength = useRef(0);
  const dropletRefs = useMemo(() => makeRefs(16), []);
  const shimmerRefs = useMemo(() => makeRefs(14), []);
  const signalRingRefs = useMemo(() => makeRefs(3), []);
  const glitchRefs = useMemo(() => makeRefs(18), []);
  const dizzyRefs = useMemo(() => makeRefs(7), []);
  const sparkRefs = useMemo(() => makeRefs(7), []);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const isOverheating = anomalyState === OVERHEAT;
    const isSignalLoss = anomalyState === SIGNAL_LOSS;
    const isUnstable = anomalyState === UNSTABLE;
    const isPowerFailure = anomalyState === POWER_FAILURE;

    wobbleStrength.current = MathUtils.damp(wobbleStrength.current, isUnstable ? 1 : 0, 4.5, delta);
    safeTiltStrength.current = MathUtils.damp(safeTiltStrength.current, isPowerFailure ? 1 : 0, 2.4, delta);

    if (model?.materials) {
      const pulse = isOverheating ? 0.5 + Math.sin(time * 4.2) * 0.5 : 0;
      model.materials.forEach((entry) => {
        const { material, baseColor, baseEmissive, isSolar } = entry;
        const dimFactor = isPowerFailure ? (isSolar ? 0.18 : 0.42) : 1;
        const heatFactor = isOverheating ? 0.68 * pulse : 0;
        material.color.copy(baseColor).multiplyScalar(dimFactor).lerp({ r: 0.85, g: 0.08, b: 0.025 }, heatFactor);
        if (material.emissive && baseEmissive) {
          material.emissive.copy(baseEmissive).multiplyScalar(dimFactor);
          if (isOverheating) material.emissive.lerp({ r: 0.88, g: 0.08, b: 0.02 }, heatFactor);
        }
        material.emissiveIntensity = isOverheating ? 0.25 + pulse * 0.45 : isPowerFailure ? 0.08 : entry.baseEmissiveIntensity;
      });

      model.antennaNodes?.forEach((entry, index) => {
        const sweep = isSignalLoss ? Math.sin(time * 5.5 + index) * 0.58 : 0;
        const jitter = isSignalLoss ? Math.sin(time * 18 + index * 2) * 0.06 : 0;
        entry.node.rotation.x = entry.baseRotation.x + jitter;
        entry.node.rotation.y = entry.baseRotation.y + sweep;
        entry.node.rotation.z = entry.baseRotation.z + Math.cos(time * 7 + index) * jitter;
      });
    }

    if (heatLight.current) {
      heatLight.current.intensity = MathUtils.damp(heatLight.current.intensity, isOverheating ? 1.2 + Math.sin(time * 3.4) * 0.25 : 0, 5, delta);
    }
    if (warningLight.current) {
      warningLight.current.intensity = MathUtils.damp(warningLight.current.intensity, isPowerFailure ? 0.38 + Math.sin(time * 1.8) * 0.08 : 0, 3, delta);
    }
    if (antennaVisual.current) antennaVisual.current.visible = isSignalLoss;

    dropletRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const cycle = (time * 0.48 + seeded(index, 3)) % 1;
      const life = Math.sin(cycle * Math.PI);
      const x = (seeded(index, 4) - 0.5) * 0.72 + Math.sin(time * 0.8 + index) * 0.025;
      const y = 0.25 - cycle * 0.82 + seeded(index, 8) * 0.12;
      const z = (seeded(index, 9) - 0.5) * 0.4;
      ref.current.position.set(x, y, z);
      ref.current.scale.setScalar(isOverheating ? 0.7 + life * 0.7 : 0.001);
      ref.current.material.opacity = isOverheating ? life * 0.7 : 0;
    });

    shimmerRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const cycle = (time * 0.2 + seeded(index, 12)) % 1;
      ref.current.position.set(
        (seeded(index, 14) - 0.5) * 0.9 + Math.sin(time + index) * 0.02,
        0.3 + cycle * 0.65,
        (seeded(index, 18) - 0.5) * 0.45,
      );
      ref.current.scale.setScalar(isOverheating ? 0.5 + Math.sin(cycle * Math.PI) * 0.8 : 0.001);
      ref.current.material.opacity = isOverheating ? (0.08 + Math.sin(cycle * Math.PI) * 0.12) : 0;
    });

    signalRingRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const cycle = (time * 0.48 + index * 0.27) % 1;
      const life = Math.sin(cycle * Math.PI);
      ref.current.scale.setScalar(isSignalLoss ? 0.7 + cycle * 1.2 : 0.001);
      ref.current.material.opacity = isSignalLoss ? life * (0.55 - index * 0.1) : 0;
      ref.current.rotation.z = Math.sin(time * 2 + index) * 0.12;
    });

    glitchRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const offset = (seeded(index, 20) - 0.5) * 2;
      const drift = Math.sin(time * (2 + seeded(index, 21)) + index) * 0.03;
      ref.current.position.set(offset * 0.85 + drift, -0.25 + seeded(index, 22) * 0.85, -0.9 - seeded(index, 23) * 1.7);
      ref.current.scale.set(isSignalLoss ? (0.35 + seeded(index, 24) * 0.75) : 0.001, isSignalLoss ? 0.02 + seeded(index, 25) * 0.09 : 0.001, 0.012);
      ref.current.material.opacity = isSignalLoss ? 0.16 + Math.abs(Math.sin(time * 10 + index)) * 0.3 : 0;
    });

    dizzyRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const angle = time * (1.2 + index * 0.07) + index * (Math.PI * 2 / dizzyRefs.length);
      const radius = 0.58 + Math.sin(time * 1.7 + index) * 0.04;
      ref.current.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72 + 0.08, Math.sin(angle) * 0.35);
      ref.current.rotation.z = angle;
      ref.current.scale.setScalar(isUnstable ? 0.55 + Math.sin(time * 4 + index) * 0.12 : 0.001);
      ref.current.material.opacity = isUnstable ? 0.68 : 0;
    });

    sparkRefs.forEach((ref, index) => {
      if (!ref.current) return;
      const cycle = (time * 0.28 + seeded(index, 30)) % 1;
      const life = cycle < 0.2 ? Math.sin((cycle / 0.2) * Math.PI) : 0;
      const angle = seeded(index, 32) * Math.PI * 2 + cycle * 4;
      ref.current.position.set(0.38 + Math.cos(angle) * (0.06 + cycle * 0.12), -0.33 + Math.sin(angle) * (0.05 + cycle * 0.1), 0.05 + Math.sin(angle * 2) * 0.08);
      ref.current.rotation.set(angle, angle * 0.7, cycle * 4);
      ref.current.scale.set(0.04 + life * 0.07, 0.06 + life * 0.18, 0.02 + life * 0.05);
      ref.current.material.opacity = isPowerFailure ? life * 0.9 : 0;
    });
  });

  return (
    <>
      <pointLight ref={heatLight} position={[0.15, 0.15, 0.25]} color="#ff6b32" intensity={0} distance={1.8} decay={2} />
      <pointLight ref={warningLight} position={[0.38, -0.32, 0.1]} color="#ff465d" intensity={0} distance={1.4} decay={2} />

      <group ref={antennaVisual} position={[0.62, 0.62, 0.05]} visible={false}>
        <mesh rotation={[0, 0, -0.25]}>
          <cylinderGeometry args={[0.012, 0.012, 0.34, 8]} />
          <meshBasicMaterial color="#b8f3ff" />
        </mesh>
        <mesh position={[0.04, 0.18, 0]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshBasicMaterial color="#ff6b6b" />
        </mesh>
      </group>

      {dropletRefs.map((ref, index) => (
        <mesh key={`droplet-${index}`} ref={ref}>
          <sphereGeometry args={[0.025, 7, 7]} />
          <meshBasicMaterial color="#57c7ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {shimmerRefs.map((ref, index) => (
        <mesh key={`shimmer-${index}`} ref={ref}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshBasicMaterial color="#ffd97a" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {signalRingRefs.map((ref, index) => (
        <mesh key={`signal-ring-${index}`} ref={ref} position={[0.62, 0.62, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14 + index * 0.02, 0.17 + index * 0.02, 32, 1, 0, Math.PI * 1.45]} />
          <meshBasicMaterial color="#6de7ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {glitchRefs.map((ref, index) => (
        <mesh key={`glitch-${index}`} ref={ref}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={index % 3 === 0 ? "#ff6b6b" : "#8bdcff"} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {dizzyRefs.map((ref, index) => (
        <mesh key={`dizzy-${index}`} ref={ref}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshBasicMaterial color={index % 2 ? "#ffd66e" : "#e8f6ff"} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {sparkRefs.map((ref, index) => (
        <mesh key={`spark-${index}`} ref={ref}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ffd47a" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
