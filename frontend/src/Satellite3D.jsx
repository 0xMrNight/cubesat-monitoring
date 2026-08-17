import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Color, MathUtils } from "three";

import AnomalyEffects from "./AnomalyEffects";

export default function Satellite3D({ rotation, onRotationChange, onInteraction, anomalyState = "normal" }) {
  const { scene } = useGLTF("/models/cubesat.glb");
  const satellite = useRef(null);
  const dragging = useRef(false);
  const mouseButton = useRef(null);
  const previousMouse = useRef({ x: 0, y: 0 });
  const baseRotation = useRef({ ...rotation });
  const wobbleStrength = useRef(0);
  const safeTiltStrength = useRef(0);

  const modelInfo = useMemo(() => {
    const materials = [];
    const antennaNodes = [];
    scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materialList = Array.isArray(object.material) ? object.material : [object.material];
        materialList.forEach((material) => {
          if (!material.color) return;
          materials.push({
            material,
            baseColor: material.color.clone(),
            baseEmissive: material.emissive?.clone() || new Color(0, 0, 0),
            baseEmissiveIntensity: material.emissiveIntensity || 0,
            isSolar: /solar|panel|cell/i.test(`${object.name} ${material.name}`),
          });
        });
      }
      if (/antenna|radio|comm|dish/i.test(object.name)) {
        antennaNodes.push({ node: object, baseRotation: object.rotation.clone() });
      }
    });
    return { materials, antennaNodes };
  }, [scene]);

  useEffect(() => {
    if (!dragging.current) baseRotation.current = { ...rotation };
  }, [rotation]);

  useFrame(({ clock }, delta) => {
    if (!satellite.current) return;
    const time = clock.getElapsedTime();
    const isUnstable = anomalyState === "unstable_motion";
    const isPowerFailure = anomalyState === "power_failure";

    wobbleStrength.current = MathUtils.damp(wobbleStrength.current, isUnstable ? 1 : 0, 4.5, delta);
    safeTiltStrength.current = MathUtils.damp(safeTiltStrength.current, isPowerFailure ? 1 : 0, 2.4, delta);

    const wobble = wobbleStrength.current;
    const safeTilt = safeTiltStrength.current;
    const dizzy = Math.sin(time * 7.6) * wobble;
    satellite.current.rotation.x = baseRotation.current.x + Math.sin(time * 4.1) * 0.2 * wobble - safeTilt * 0.22;
    satellite.current.rotation.y = baseRotation.current.y + Math.cos(time * 5.7) * 0.25 * wobble + Math.sin(time * 2.1) * 0.06 * wobble;
    satellite.current.rotation.z = baseRotation.current.z + Math.sin(time * 6.8 + 1.4) * 0.18 * wobble + dizzy * 0.04 - safeTilt * 0.13;
  });

  const handlePointerDown = (event) => {
    event.stopPropagation();
    mouseButton.current = event.button === -1 ? 0 : event.button;
    dragging.current = true;
    previousMouse.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging.current || !satellite.current) return;
    event.stopPropagation();

    const deltaX = event.clientX - previousMouse.current.x;
    const deltaY = event.clientY - previousMouse.current.y;
    const intensity = Math.min(100, Math.hypot(deltaX, deltaY) * 2.2);

    if (mouseButton.current === 0) {
      baseRotation.current.y += deltaX * 0.018;
      baseRotation.current.x += deltaY * 0.018;
    } else if (mouseButton.current === 2) {
      baseRotation.current.z += deltaX * 0.025;
    }

    previousMouse.current = { x: event.clientX, y: event.clientY };
    onInteraction?.(intensity);
    onRotationChange({ ...baseRotation.current });
  };

  const handlePointerUp = (event) => {
    event.stopPropagation();
    dragging.current = false;
    mouseButton.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <group
      ref={satellite}
      rotation={[rotation.x, rotation.y, rotation.z]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <primitive object={scene} scale={1} />
      <AnomalyEffects anomalyState={anomalyState} model={modelInfo} />
    </group>
  );
}

useGLTF.preload("/models/cubesat.glb");
