"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import { easing } from "maath";
import * as THREE from "three";
import { palette } from "@/lib/colors";
import type { JobState } from "@/lib/types";

const STATES: { state: JobState; label: string }[] = [
  { state: "DRAFT", label: "DRAFT" },
  { state: "LOCKED", label: "LOCKED" },
  { state: "IN_PROGRESS", label: "IN_PROGRESS" },
  { state: "SUBMITTED", label: "SUBMITTED" },
  { state: "VERIFYING", label: "VERIFYING" },
  { state: "CAPTURED", label: "CAPTURED" },
];

function stateColor(state: JobState): string {
  switch (state) {
    case "LOCKED":
      return palette.warning;
    case "CAPTURED":
      return palette.success;
    case "FAILED":
      return palette.danger;
    case "DRAFT":
    case "IN_PROGRESS":
    case "VERIFYING":
    case "SUBMITTED":
    default:
      return palette.primary;
  }
}

const { innerWidth } =
  typeof window !== "undefined" ? window : { innerWidth: 1200 };
const SPACING = 3.4;
const START_X = -((STATES.length - 1) * SPACING) / 2;

function Node({
  state,
  label,
  index,
  active,
  failed,
}: {
  state: JobState;
  label: string;
  index: number;
  active: boolean;
  failed: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const color = failed ? palette.danger : stateColor(state);

  useFrame(({ clock }, delta) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    const pulse = active ? 1 + Math.sin(t * 4) * 0.12 : 1;
    easing.damp3(mesh.current.scale, [pulse, pulse, pulse], 0.18, delta);
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = active ? 0.5 + Math.sin(t * 4) * 0.2 : 0.18;
    }
  });

  const nodeType = state === "LOCKED" ? "lock" : state === "CAPTURED" ? "capture" : "normal";

  return (
    <group position={[START_X + index * SPACING, 0, 0]}>
      <mesh ref={mesh}>
        {nodeType === "lock" ? (
          <icosahedronGeometry args={[0.9, 0]} />
        ) : nodeType === "capture" ? (
          <octahedronGeometry args={[0.95, 0]} />
        ) : (
          <sphereGeometry args={[0.7, 32, 32]} />
        )}
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} />
      </mesh>
      {/* glow halo */}
      <mesh ref={glow} scale={1.6}>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <Html center position={[0, -1.6, 0]} distanceFactor={8}>
        <div
          className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color, backgroundColor: "rgba(255,255,255,0.9)" }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

function Link({ start, end }: { start: number; end: number }) {
  const line = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(START_X + start * SPACING, 0, 0),
      new THREE.Vector3(START_X + end * SPACING, 0, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: palette.glow,
      transparent: true,
      opacity: 0.3,
    });
    const l = new THREE.Line(geom, mat);
    l.name = `link-${start}-${end}`;
    return l;
  }, [start, end]);

  useFrame(({ clock }) => {
    const m = line.material as THREE.LineBasicMaterial;
    m.opacity = 0.25 + Math.sin(clock.elapsedTime * 2) * 0.1;
  });

  return <primitive object={line} />;
}

function Chain({ activeIdx, failed }: { activeIdx: number; failed: boolean }) {
  return (
    <group>
      {STATES.map((s, i) => (
        <Node
          key={s.state}
          state={s.state}
          label={s.label}
          index={i}
          active={i === activeIdx}
          failed={failed && i === activeIdx}
        />
      ))}
      {STATES.slice(0, -1).map((_, i) => (
        <Link key={i} start={i} end={i + 1} />
      ))}
    </group>
  );
}

function Rig({ activeIdx }: { activeIdx: number }) {
  useFrame((state, delta) => {
    const target = new THREE.Vector3(
      START_X + activeIdx * SPACING,
      0,
      7,
    );
    easing.damp3(state.camera.position, target, 0.6, delta);
    state.camera.lookAt(START_X + activeIdx * SPACING, 0, 0);
  });
  return null;
}

export default function ProofGate3D({ state }: { state: JobState }) {
  const activeIdx = Math.max(0, STATES.findIndex((s) => s.state === state));
  const failed = state === "FAILED";

  return (
    <div className="relative h-[340px] w-full overflow-hidden rounded-2xl border border-ink/5 bg-gradient-to-br from-[#eef2ff] to-[#f6f7f9] sm:h-[400px]">
      <Canvas
        camera={{ position: [START_X, 0, 7], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[5, 6, 5]} intensity={1.4} />
        <pointLight position={[0, 0, 4]} intensity={1.6} color={palette.glow} />
        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
          <Chain activeIdx={activeIdx} failed={failed} />
        </Float>
        <Rig activeIdx={activeIdx} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.6}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/85 px-3 py-1 text-[11px] font-medium text-muted backdrop-blur">
        {failed
          ? "FAIL — rework loop split"
          : state === "LOCKED"
          ? "Money locked pending proof"
          : state === "CAPTURED"
          ? "Settled — payment captured"
          : "Deterministic proof chain"}
      </div>
    </div>
  );
}
