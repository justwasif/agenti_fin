import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────
   Light financial palette (matches :root in index.css)
   ───────────────────────────────────────────────────────── */
const C = {
  ink:    "#0f1b2d",
  indigo: "#3730a3",   // escrow
  teal:   "#0e7490",   // criteria
  amber:  "#b45309",   // agent
  green:  "#0f766e",   // capture
  red:    "#b91c1c",   // fail
  paper:  "#f7f5f0",
  gold:   "#c5973c",   // for the gold coins
};

/* ─────────────────────────────────────────────────────────
   1. STACK OF GOLD COINS — represents locked funds (escrow)
   ───────────────────────────────────────────────────────── */
function CoinStack() {
  const group = useRef<THREE.Group>(null);

  // gold-ish metallic material
  const coinMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.gold,
        metalness: 0.85,
        roughness: 0.25,
        emissive: new THREE.Color(C.amber),
        emissiveIntensity: 0.05,
      }),
    []
  );
  const edgeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8a6a25",
        metalness: 0.9,
        roughness: 0.4,
      }),
    []
  );

  const coinGeo = useMemo(() => new THREE.CylinderGeometry(0.9, 0.9, 0.14, 32), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = t * 0.25;
      group.current.position.y = Math.sin(t * 0.6) * 0.1;
    }
  });

  // 5 coins stacked, smallest offset for realism
  return (
    <group ref={group} position={[-3.4, 0, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[0, i * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={coinGeo} material={coinMat} />
          <mesh
            geometry={new THREE.TorusGeometry(0.85, 0.018, 8, 48)}
            material={edgeMat}
            rotation={[0, 0, 0]}
          />
        </group>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   2. VAULT DOOR (cylinder + handle) — represents the escrow lock
   ───────────────────────────────────────────────────────── */
function Vault() {
  const ref = useRef<THREE.Group>(null);
  const handle = useRef<THREE.Group>(null);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a6b85",
        metalness: 0.7,
        roughness: 0.35,
      }),
    []
  );
  const innerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.indigo,
        emissive: new THREE.Color(C.indigo),
        emissiveIntensity: 0.25,
        metalness: 0.6,
        roughness: 0.3,
      }),
    []
  );
  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.gold,
        metalness: 0.9,
        roughness: 0.2,
      }),
    []
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = Math.sin(t * 0.4) * 0.18;
      ref.current.position.y = Math.sin(t * 0.8) * 0.08;
    }
    if (handle.current) {
      handle.current.rotation.z = t * 0.6;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* outer door */}
      <mesh material={bodyMat} position={[0, 0, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.45, 32]} />
      </mesh>
      {/* inner ring */}
      <mesh material={innerMat} position={[0, 0, 0.23]}>
        <cylinderGeometry args={[1.1, 1.1, 0.06, 32]} />
      </mesh>
      {/* center hub */}
      <mesh material={goldMat} position={[0, 0, 0.27]}>
        <cylinderGeometry args={[0.35, 0.35, 0.08, 24]} />
      </mesh>
      {/* spinning handle */}
      <group ref={handle} position={[0, 0, 0.3]}>
        <mesh
          geometry={new THREE.BoxGeometry(0.08, 1.1, 0.08)}
          material={goldMat}
        />
        <mesh
          geometry={new THREE.BoxGeometry(1.1, 0.08, 0.08)}
          material={goldMat}
        />
        <mesh
          geometry={new THREE.TorusGeometry(0.18, 0.05, 8, 24)}
          material={goldMat}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   3. CONTRACT DOCUMENT — frozen test cases (rectangular sheet + lines)
   ───────────────────────────────────────────────────────── */
function ContractDoc({ offset = 0 }: { offset?: number }) {
  const ref = useRef<THREE.Group>(null);
  const count = 4;

  const paperMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 0.0,
        roughness: 0.85,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.04,
      }),
    []
  );
  const checkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.green,
        metalness: 0.4,
        roughness: 0.3,
      }),
    []
  );

  // Build geometry once
  const sheetGeo = useMemo(() => new THREE.BoxGeometry(0.95, 1.3, 0.04), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.18 + offset;
      ref.current.rotation.x = Math.sin(t * 0.4 + offset) * 0.18;
      ref.current.position.y = Math.sin(t * 0.6 + offset) * 0.15;
    }
  });

  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return {
          x: Math.cos(a) * 3.0,
          y: Math.sin(a * 0.6) * 0.4,
          z: Math.sin(a) * 3.0,
          rowLen: 0.35 + ((i * 37) % 7) * 0.04, // deterministic pseudo-random
        };
      }),
    []
  );

  // Pre-build a single shared "line row" geometry (reused 4x per sheet)
  const lineRowGeo = useMemo(() => new THREE.BoxGeometry(1.0, 0.012, 0.005), []);
  const inkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.ink,
        metalness: 0,
        roughness: 0.6,
      }),
    []
  );

  return (
    <group ref={ref}>
      {items.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh geometry={sheetGeo} material={paperMat} />
          {/* Horizontal "text" rows — thin boxes */}
          {[0, 1, 2, 3].map((row) => (
            <mesh
              key={row}
              geometry={lineRowGeo}
              material={inkMat}
              position={[-0.05, 0.42 - row * 0.18, 0.025]}
              scale={[p.rowLen + row * 0.05, 1, 1]}
            />
          ))}
          {/* Title bar */}
          <mesh position={[0, 0.55, 0.025]}>
            <boxGeometry args={[0.7, 0.08, 0.01]} />
            <meshStandardMaterial color={C.teal} />
          </mesh>
          {/* Checkmark badge */}
          <mesh position={[0.3, 0.42, 0.03]} material={checkMat}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   4. BAR CHART — proof metrics / verifier results
   ───────────────────────────────────────────────────────── */
function BarChart() {
  const ref = useRef<THREE.Group>(null);

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cdd2da",
        metalness: 0.2,
        roughness: 0.6,
      }),
    []
  );
  const barMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.green,
        metalness: 0.2,
        roughness: 0.5,
        emissive: new THREE.Color(C.green),
        emissiveIntensity: 0.1,
      }),
    []
  );
  const bar2Mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.amber,
        metalness: 0.2,
        roughness: 0.5,
      }),
    []
  );

  const heights = [0.8, 1.2, 0.6, 1.5, 1.0, 1.4, 0.9];

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.22;
      ref.current.position.y = Math.sin(t * 0.5) * 0.12;
    }
  });

  return (
    <group ref={ref} position={[3.4, -0.4, 0]}>
      {/* Base plate */}
      <mesh material={baseMat} position={[0, -0.85, 0]}>
        <boxGeometry args={[2.4, 0.08, 0.9]} />
      </mesh>
      {/* Bars */}
      {heights.map((h, i) => {
        const x = (i - 3) * 0.32;
        const mat = i === 3 || i === 5 ? bar2Mat : barMat;
        return (
          <mesh
            key={i}
            material={mat}
            position={[x, -0.85 + h / 2, 0]}
          >
            <boxGeometry args={[0.18, h, 0.5]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   5. VERIFIED SEAL — green starburst (the PASS mark)
   ───────────────────────────────────────────────────────── */
function VerifiedSeal() {
  const ref = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  const sealMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.green,
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(C.green),
        emissiveIntensity: 0.25,
      }),
    []
  );
  const checkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.4,
      }),
    []
  );

  // star-shaped seal (cylinder + 8 spikes via cones)
  const sealGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 16;
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.7 : 0.5;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  }, []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const orbit = 4.6;
      ref.current.position.x = Math.cos(-t * 0.3) * orbit;
      ref.current.position.z = Math.sin(-t * 0.3) * orbit;
      ref.current.position.y = Math.sin(t * 0.7) * 0.7;
      ref.current.rotation.z = -t * 0.4;
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <group ref={ref}>
      <mesh geometry={sealGeo} material={sealMat} rotation={[0, 0, 0]} />
      <mesh ref={innerRef} position={[0, 0, 0.16]}>
        <torusGeometry args={[0.32, 0.05, 12, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* check mark using two boxes */}
      <group position={[0, 0, 0.18]} rotation={[0, 0, -Math.PI / 4]}>
        <mesh material={checkMat} position={[-0.08, 0, 0]}>
          <boxGeometry args={[0.08, 0.28, 0.04]} />
        </mesh>
        <mesh material={checkMat} position={[0.12, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.08, 0.4, 0.04]} />
        </mesh>
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   6. RED FAIL FLAG — small ribbon for the retry signal
   ───────────────────────────────────────────────────────── */
function FailFlag() {
  const ref = useRef<THREE.Group>(null);
  const flagRef = useRef<THREE.Mesh>(null);

  const poleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9aa3b2",
        metalness: 0.6,
        roughness: 0.4,
      }),
    []
  );
  const flagMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.red,
        side: THREE.DoubleSide,
        metalness: 0.2,
        roughness: 0.6,
        emissive: new THREE.Color(C.red),
        emissiveIntensity: 0.15,
      }),
    []
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const orbit = 5.6;
      ref.current.position.x = Math.cos(t * 0.22 + Math.PI / 3) * orbit;
      ref.current.position.z = Math.sin(t * 0.22 + Math.PI / 3) * orbit;
      ref.current.position.y = Math.cos(t * 0.5) * 1.0;
    }
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(t * 2) * 0.4;
    }
  });

  return (
    <group ref={ref}>
      <mesh material={poleMat} position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
      </mesh>
      <mesh
        ref={flagRef}
        material={flagMat}
        position={[0.2, 0.05, 0]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[0.5, 0.32]} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   Background — sparse dust motes (very subtle, paper feel)
   ───────────────────────────────────────────────────────── */
function PaperDust() {
  const ref = useRef<THREE.Points>(null);
  const count = 250;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 7 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.04,
        sizeAttenuation: true,
        color: "#9aa3b2",
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    []
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.02;
    }
  });

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ─────────────────────────────────────────────────────────
   Camera — slow drift
   ───────────────────────────────────────────────────────── */
function CameraRig() {
  const { camera } = useThree();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.05) * 0.4;
    camera.position.y = Math.cos(t * 0.07) * 0.3;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ─────────────────────────────────────────────────────────
   LandingPage
   ───────────────────────────────────────────────────────── */
interface Props {
  onLaunch: () => void;
}

export default function LandingPage({ onLaunch }: Props) {
  const [exiting, setExiting] = useState(false);

  function handleLaunch() {
    if (exiting) return;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("powp-demo-state");
    }
    setExiting(true);
    setTimeout(() => onLaunch(), 700);
  }

  return (
    <div className={`landing ${exiting ? "landing-exit" : ""}`}>
      {/* Background 3D canvas */}
      <div className="landing-canvas">
        <Canvas
          camera={{ position: [0, 0, 8.5], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          {/* Soft, paper-friendly lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 6, 6]} intensity={1.0} color="#ffffff" />
          <pointLight position={[-4, 3, 3]} intensity={0.6} color={C.amber} />
          <pointLight position={[4, -2, 4]} intensity={0.5} color={C.teal} />
          <pointLight position={[0, -4, 2]} intensity={0.4} color={C.indigo} />

          <CameraRig />
          <PaperDust />
          <CoinStack />
          <Vault />
          <ContractDoc />
          <BarChart />
          <VerifiedSeal />
          <FailFlag />
        </Canvas>
      </div>

      {/* Foreground content */}
      <div className="landing-content">
        <div className="landing-topnav">
          <div className="landing-brand">
            <span className="landing-brand-mark" aria-hidden="true">$</span>
            <span className="landing-brand-name">
              Proof<span className="landing-brand-accent">Of</span>WorkPay
            </span>
          </div>
          <div className="landing-topnav-meta">
            <span className="landing-dot" />
            <span>Live demo · test mode</span>
          </div>
        </div>

        <div className="landing-hero">
          <div className="landing-eyebrow">
            <span className="landing-eyebrow-bar" />
            <span>Money held in escrow by your own tests</span>
          </div>

          <h1 className="landing-title">
            Pay only when<br />
            <span className="landing-title-em">your tests pass.</span>
          </h1>

          <p className="landing-tagline">
            Lock funds on day one. The verifier, not the buyer,
            releases them the moment your acceptance tests turn green.
            No release button. No disputes. Just verifiable delivery.
          </p>

          <div className="landing-cta-row">
            <button className="landing-cta" onClick={handleLaunch}>
              Launch demo
              <span className="landing-cta-arrow">→</span>
            </button>
            <div className="landing-trust">
              <span>Stripe test mode</span>
              <span className="landing-trust-dot" />
              <span>Deterministic verifier</span>
              <span className="landing-trust-dot" />
              <span>5/5 → capture</span>
            </div>
          </div>
        </div>

        <div className="landing-stages">
          <div className="landing-stage">
            <span className="landing-stage-num" style={{ background: C.indigo }}>1</span>
            <span className="landing-stage-name">Lock</span>
            <span className="landing-stage-desc">escrow the funds</span>
          </div>
          <div className="landing-stage">
            <span className="landing-stage-num" style={{ background: C.teal }}>2</span>
            <span className="landing-stage-name">Criteria</span>
            <span className="landing-stage-desc">freeze the tests</span>
          </div>
          <div className="landing-stage">
            <span className="landing-stage-num" style={{ background: C.amber }}>3</span>
            <span className="landing-stage-name">Work</span>
            <span className="landing-stage-desc">agent delivers</span>
          </div>
          <div className="landing-stage">
            <span className="landing-stage-num" style={{ background: C.green }}>4</span>
            <span className="landing-stage-name">Verify</span>
            <span className="landing-stage-desc">verifier releases</span>
          </div>
        </div>
      </div>
    </div>
  );
}
