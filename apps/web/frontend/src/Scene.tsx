import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────
   Light financial background — sparse dust + slow torus
   Faint, paper-friendly. Sits behind cards in the demo page.
   ───────────────────────────────────────────────────────── */
function DustField({ count = 350 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.02;
      ref.current.rotation.x = t * 0.01;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#9aa3b2"
        size={0.04}
        sizeAttenuation
        depthWrite={false}
        opacity={0.45}
      />
    </Points>
  );
}

function SoftRing() {
  const ref = useRef<THREE.LineSegments>(null);

  const geo = useMemo(() => new THREE.TorusGeometry(4.2, 0.12, 60, 120), []);
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#cdd2da",
        transparent: true,
        opacity: 0.35,
      }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.x = t * 0.05;
      ref.current.rotation.y = -t * 0.04;
    }
  });

  return (
    <lineSegments
      ref={ref}
      geometry={new THREE.EdgesGeometry(geo)}
      material={mat}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   Scene — fixed full-screen canvas behind the app (z-index: 0)
   Subtle and paper-friendly for the light theme.
   ───────────────────────────────────────────────────────── */
export default function Scene() {
  return (
    <div className="scene-bg">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        <DustField count={350} />
        <SoftRing />
      </Canvas>
    </div>
  );
}
