import { Routes, Route, useNavigate } from "react-router-dom";
import Scene from "./Scene";
import LandingPage from "./components/LandingPage";
import Demo from "./components/Demo";

export type DemoState = "idle" | "draft" | "frozen" | "running" | "done";

function LandingRoute() {
  const navigate = useNavigate();
  return <LandingPage onLaunch={() => navigate("/demo")} />;
}

function Shell() {
  return (
    <>
      {/* Three.js animated background — fixed, full-screen */}
      <div className="scene-bg">
        <Scene />
      </div>

      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<LandingRoute />} />
      </Routes>
    </>
  );
}

export default function App() {
  return <Shell />;
}
