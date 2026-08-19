"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Globe, Shield, Sparkles } from "lucide-react";

export function SovereignHeader() {
  const [isLocal, setIsLocal] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("mukti_inference_mode");
    if (saved === "LOCAL") {
      setIsLocal(true);
    }
  }, []);

  const toggleMode = () => {
    const next = !isLocal;
    setIsLocal(next);
    localStorage.setItem("mukti_inference_mode", next ? "LOCAL" : "CLOUD");
  };

  return (
    <aside className="sovereign-strip" aria-label="Sovereign Governance and Demonstration Quick Switcher">
      <div className="sovereign-strip-inner">
        {/* Left: Ministry identity */}
        <div className="sovereign-identity">
          <Shield size={13} className="sovereign-icon" />
          <span className="sovereign-text">
            MINISTRY OF LAW & JUSTICE · e-COURTS / NALSA INTEGRATION GATEWAY
          </span>
        </div>

        {/* Center: 1-Click Demo Quick Switcher Chips */}
        <nav className="demo-switcher" aria-label="Demo Persona Presets">
          <span className="demo-label">DEMO PRESETS:</span>
          <Link
            href="/cases/CASE-1042"
            className={`demo-chip chip-eligible ${pathname === "/cases/CASE-1042" ? "active" : ""}`}
            title="Load Case 1: First-timer 1/3 threshold met (Aarav Kumar)"
          >
            <span className="chip-dot" />
            <span className="chip-title">Demo 1 · First-Timer 1/3 Release</span>
          </Link>

          <Link
            href="/cases/CASE-5099"
            className={`demo-chip chip-ineligible ${pathname === "/cases/CASE-5099" ? "active" : ""}`}
            title="Load Case 2: S.302 Life offence statutory exclusion (Rohit Das)"
          >
            <span className="chip-dot" />
            <span className="chip-title">Demo 2 · S.302 Life Exclusion</span>
          </Link>

          <Link
            href="/cases/CASE-3156"
            className={`demo-chip chip-flagged ${pathname === "/cases/CASE-3156" ? "active" : ""}`}
            title="Load Case 3: Contested accused-delay requiring review (Imran Khan)"
          >
            <span className="chip-dot" />
            <span className="chip-title">Demo 3 · Contested Delay Flag</span>
          </Link>
        </nav>

        {/* Right: Network & Inference Mode Badges */}
        <div className="sovereign-status">
          <span className="sovereign-badge icjs-badge" title="Secure ICJS / e-Prisons API Gateway active">
            <span className="pulse-green" />
            <span>PRISON INTRANET CONNECTED (ICJS-READY)</span>
          </span>

          <button
            type="button"
            className={`sovereign-badge mode-toggle ${isLocal ? "local-active" : "cloud-active"}`}
            onClick={toggleMode}
            title="Click to toggle between Cloud Groq LLM and Air-gapped Local Ollama LLM"
            aria-label="Toggle inference mode"
          >
            {isLocal ? (
              <>
                <Cpu size={13} className="mode-icon text-amber" />
                <span className="mode-dot-amber" />
                <span>LOCAL MODE: Ollama Llama-3 (AIR-GAPPED)</span>
              </>
            ) : (
              <>
                <Globe size={13} className="mode-icon text-cyan" />
                <span className="mode-dot-cyan" />
                <span>CLOUD MODE: Groq Llama-3</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
