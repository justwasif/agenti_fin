import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────
   Light financial palette
   ───────────────────────────────────────────────────────── */
const C = {
  ink:    "#0f1b2d",
  indigo: "#3730a3",
  teal:   "#0e7490",
  amber:  "#b45309",
  green:  "#0f766e",
  red:    "#b91c1c",
  paper:  "#f7f5f0",
  gold:   "#c5973c",
  card:   "#1a2540",   // dark wallet card front
  card2:  "#9ab3d6",   // card back
};

/* ─────────────────────────────────────────────────────────
   1. WALLET — main dark card with chip + "card" feel
   ───────────────────────────────────────────────────────── */
function Wallet() {
  const ref = useRef<THREE.Group>(null);

  const cardMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.card,
        metalness: 0.55,
        roughness: 0.35,
        emissive: new THREE.Color(C.indigo),
        emissiveIntensity: 0.12,
      }),
    []
  );
  const chipMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.gold,
        metalness: 0.95,
        roughness: 0.2,
      }),
    []
  );
  const stripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.teal,
        metalness: 0.3,
        roughness: 0.5,
        emissive: new THREE.Color(C.teal),
        emissiveIntensity: 0.1,
      }),
    []
  );

  // 2:1.25 ratio, like a real card
  const cardGeo = useMemo(() => new THREE.BoxGeometry(2.4, 1.5, 0.06, 1, 1, 1), []);
  const chipGeo = useMemo(() => new THREE.BoxGeometry(0.28, 0.22, 0.04), []);
  const stripeGeo = useMemo(() => new THREE.BoxGeometry(2.2, 0.18, 0.005), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = Math.sin(t * 0.35) * 0.25;
      ref.current.rotation.x = Math.sin(t * 0.4 + 0.3) * 0.18;
      ref.current.position.y = Math.sin(t * 0.7) * 0.1;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* card */}
      <mesh geometry={cardGeo} material={cardMat} />
      {/* gold chip */}
      <mesh
        geometry={chipGeo}
        material={chipMat}
        position={[-0.85, 0.25, 0.04]}
      />
      {/* bottom teal stripe (like a brand bar) */}
      <mesh
        geometry={stripeGeo}
        material={stripeMat}
        position={[0, -0.55, 0.04]}
      />
      {/* "$" mark on the right */}
      <mesh position={[0.95, 0.3, 0.04]}>
        <torusGeometry args={[0.13, 0.025, 12, 24]} />
        <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.95, 0.3, 0.04]}>
        <boxGeometry args={[0.02, 0.22, 0.005]} />
        <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* a few "ink" lines representing text */}
      {[-0.1, -0.3].map((y, i) => (
        <mesh key={i} position={[0.2, y, 0.04]}>
          <boxGeometry args={[1.2, 0.03, 0.005]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   2. STACKED PAYMENT CARDS — second/third cards behind wallet
   ───────────────────────────────────────────────────────── */
function CardStack() {
  const ref = useRef<THREE.Group>(null);

  const mat1 = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9ab3d6",
        metalness: 0.4,
        roughness: 0.45,
        emissive: new THREE.Color("#9ab3d6"),
        emissiveIntensity: 0.05,
      }),
    []
  );
  const mat2 = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.teal,
        metalness: 0.5,
        roughness: 0.4,
        emissive: new THREE.Color(C.teal),
        emissiveIntensity: 0.1,
      }),
    []
  );
  const cardGeo = useMemo(() => new THREE.BoxGeometry(2.0, 1.25, 0.05), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = Math.sin(t * 0.22 + 0.4) * 0.3;
      ref.current.position.y = Math.sin(t * 0.55 + 0.5) * 0.12;
    }
  });

  return (
    <group ref={ref} position={[-2.6, -0.3, -0.4]}>
      <mesh geometry={cardGeo} material={mat1} position={[0, 0, -0.3]} rotation={[0, 0, 0.05]} />
      <mesh geometry={cardGeo} material={mat2} position={[0, 0.05, -0.15]} rotation={[0, 0, -0.04]} />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   3. AI AGENT NODE — orb with halo + inner glow (the agent)
   ───────────────────────────────────────────────────────── */
function AgentNode() {
  const ref = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const coreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.amber,
        emissive: new THREE.Color(C.amber),
        emissiveIntensity: 0.7,
        metalness: 0.6,
        roughness: 0.2,
      }),
    []
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: C.amber,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
    []
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: C.amber,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    []
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const orbit = 4.0;
      ref.current.position.x = Math.cos(t * 0.45) * orbit;
      ref.current.position.z = Math.sin(t * 0.45) * orbit;
      ref.current.position.y = Math.sin(t * 0.7) * 0.9;
      ref.current.rotation.y = t * 0.5;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = -t * 0.4;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.6;
      ringRef.current.rotation.z = t * 0.3;
    }
  });

  return (
    <group ref={ref}>
      {/* core sphere */}
      <mesh material={coreMat}>
        <icosahedronGeometry args={[0.5, 1]} />
      </mesh>
      {/* faint outer halo */}
      <mesh ref={haloRef} material={haloMat}>
        <sphereGeometry args={[0.95, 24, 24]} />
      </mesh>
      {/* tilted ring */}
      <mesh
        ref={ringRef}
        material={ringMat}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.8, 0.018, 8, 48]} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   4. TOKEN COIN — small floating currency tokens in orbit
   ───────────────────────────────────────────────────────── */
function TokenCoin({ angle, color, speed, radius }: { angle: number; color: string; speed: number; radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const baseAngle = angle;

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.85,
        roughness: 0.25,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.15,
      }),
    [color]
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

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const a = baseAngle + t * speed;
      ref.current.position.x = Math.cos(a) * radius;
      ref.current.position.z = Math.sin(a) * radius;
      ref.current.position.y = Math.sin(a * 0.8) * 0.6;
      ref.current.rotation.y = t * 1.2;
    }
  });

  return (
    <group ref={ref as any}>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.08, 24]} />
      </mesh>
      <mesh material={edgeMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <torusGeometry args={[0.3, 0.012, 8, 24]} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   5. VAULT CUBE — the locked escrow (geometric safe)
   ───────────────────────────────────────────────────────── */
function VaultCube() {
  const ref = useRef<THREE.Group>(null);
  const dialRef = useRef<THREE.Mesh>(null);

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
      ref.current.rotation.y = Math.sin(t * 0.3 + 1) * 0.2;
      ref.current.position.y = Math.sin(t * 0.6 + 1) * 0.08;
    }
    if (dialRef.current) {
      dialRef.current.rotation.z = -t * 0.5;
    }
  });

  return (
    <group ref={ref} position={[2.7, 0.2, 0]}>
      <mesh material={bodyMat}>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
      </mesh>
      {/* indigo face plate */}
      <mesh material={innerMat} position={[0, 0, 0.66]}>
        <boxGeometry args={[0.9, 0.9, 0.04]} />
      </mesh>
      {/* spinning gold dial */}
      <mesh ref={dialRef} material={goldMat} position={[0, 0, 0.7]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 24]} />
      </mesh>
      <mesh
        material={goldMat}
        position={[0, 0, 0.74]}
        rotation={[0, 0, 0]}
      >
        <torusGeometry args={[0.18, 0.025, 8, 24]} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   6. RECEIPT / CONTRACT — small floating document
   ───────────────────────────────────────────────────────── */
function Receipt() {
  const ref = useRef<THREE.Group>(null);

  const paperMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 0,
        roughness: 0.85,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.04,
      }),
    []
  );
  const inkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.ink,
        metalness: 0,
        roughness: 0.6,
      }),
    []
  );
  const sheetGeo = useMemo(() => new THREE.BoxGeometry(0.7, 0.95, 0.02), []);
  const rowGeo = useMemo(() => new THREE.BoxGeometry(0.5, 0.02, 0.005), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const orbit = 5.2;
      ref.current.position.x = Math.cos(t * 0.28 + Math.PI) * orbit;
      ref.current.position.z = Math.sin(t * 0.28 + Math.PI) * orbit;
      ref.current.position.y = Math.sin(t * 0.6 + 1) * 0.7;
      ref.current.rotation.y = -t * 0.4;
    }
  });

  return (
    <group ref={ref}>
      <mesh geometry={sheetGeo} material={paperMat} />
      {/* header bar */}
      <mesh position={[0, 0.35, 0.012]}>
        <boxGeometry args={[0.55, 0.06, 0.005]} />
        <meshStandardMaterial color={C.green} />
      </mesh>
      {/* ink rows */}
      {[0.18, 0.05, -0.08, -0.21].map((y, i) => (
        <mesh
          key={i}
          geometry={rowGeo}
          material={inkMat}
          position={[-0.05, y, 0.012]}
          scale={[0.7 + (i % 2) * 0.3, 1, 1]}
        />
      ))}
      {/* signature line */}
      <mesh position={[0, -0.36, 0.012]}>
        <boxGeometry args={[0.45, 0.015, 0.005]} />
        <meshStandardMaterial color={C.amber} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   7. APPROVED STAMP — green checkmark seal
   ───────────────────────────────────────────────────────── */
function ApprovedStamp() {
  const ref = useRef<THREE.Group>(null);

  const stampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.green,
        emissive: new THREE.Color(C.green),
        emissiveIntensity: 0.25,
        metalness: 0.5,
        roughness: 0.3,
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

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const points = 14;
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.55 : 0.4;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  }, []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      const orbit = 5.6;
      ref.current.position.x = Math.cos(-t * 0.24) * orbit;
      ref.current.position.z = Math.sin(-t * 0.24) * orbit;
      ref.current.position.y = Math.cos(t * 0.5) * 0.7;
      ref.current.rotation.z = t * 0.35;
    }
  });

  return (
    <group ref={ref}>
      <mesh geometry={shape} material={stampMat} />
      <group position={[0, 0, 0.08]} rotation={[0, 0, -Math.PI / 4]}>
        <mesh material={checkMat} position={[-0.07, 0, 0]}>
          <boxGeometry args={[0.07, 0.22, 0.03]} />
        </mesh>
        <mesh material={checkMat} position={[0.1, -0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.07, 0.32, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   Background — sparse paper dust
   ───────────────────────────────────────────────────────── */
function PaperDust() {
  const ref = useRef<THREE.Points>(null);
  const count = 200;

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
        opacity: 0.4,
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
      <div className="landing-canvas">
        <Canvas
          camera={{ position: [0, 0, 8.5], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 6, 6]} intensity={1.0} color="#ffffff" />
          <pointLight position={[-4, 3, 3]} intensity={0.6} color={C.amber} />
          <pointLight position={[4, -2, 4]} intensity={0.5} color={C.teal} />
          <pointLight position={[0, -4, 2]} intensity={0.4} color={C.indigo} />

          <CameraRig />
          <PaperDust />

          {/* The wallet + cards + vault + agent composition */}
          <Wallet />
          <CardStack />
          <VaultCube />
          <AgentNode />

          {/* Orbiting tokens (currency) */}
          <TokenCoin angle={0.0}  color={C.gold}  speed={0.5}  radius={3.2} />
          <TokenCoin angle={1.6}  color={C.teal}  speed={0.4}  radius={3.6} />
          <TokenCoin angle={3.2}  color={C.green} speed={0.45} radius={3.4} />
          <TokenCoin angle={4.8}  color={C.amber} speed={0.55} radius={3.8} />

          {/* Orbiting docs / seals */}
          <Receipt />
          <ApprovedStamp />
        </Canvas>
      </div>

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
            <span>Agentic wallet · money held by your own tests</span>
          </div>

          <h1 className="landing-title">
            Pay only when<br />
            <span className="landing-title-em">your tests pass.</span>
          </h1>

          <p className="landing-tagline">
            Lock funds in an agentic wallet on day one. The verifier,
            not the buyer, releases them the moment your acceptance
            tests turn green. No release button. No disputes.
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
