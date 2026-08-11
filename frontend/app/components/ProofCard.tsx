"use client";

import { useEffect, useRef } from "react";
import { FileText, Scale } from "lucide-react";
import gsap from "gsap";
import type { Decision, ProofSource } from "../../lib/api";

export function ProofCard({ decision, sources = [] }: { decision: Decision; sources?: ProofSource[] }) {
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docRef.current) return;
    const boxes = docRef.current.querySelectorAll(".bounding");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boxes.forEach((b) => ((b as SVGElement).style.strokeDashoffset = "0"));
      return;
    }
    gsap.fromTo(
      boxes,
      { strokeDashoffset: 220 },
      { strokeDashoffset: 0, stagger: 0.35, duration: 0.9, ease: "power2.inOut", delay: 0.3 }
    );
  }, [decision]);

  const facts = [
    { label: "Detention served", value: `${decision.detention_days ?? "—"} days` },
    { label: "Qualifying custody", value: `${decision.qualifying_detention_days ?? decision.detention_days ?? "—"} days` },
    { label: "Section 479 threshold", value: `${decision.threshold_days ?? "—"} days` },
    { label: "Days remaining", value: `${decision.days_remaining ?? "—"}` },
    { label: "Rule result", value: decision.status.replace(/_/g, " ") },
  ];
  const selectedSources = sources.filter((source) => source.selected);

  return (
    <section className="panel proof-panel">
      <p className="eyebrow">PROOF CARD · {decision.rule_version}</p>
      <h3>Auditable evidence</h3>
      <div className="proof-top">
        <div className="fact-grid proof-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <small>{fact.label}</small>
              <b>{fact.value}</b>
            </div>
          ))}
        </div>
        <div className="proof-meta">
          <span>
            <FileText size={14} /> {decision.legal_basis}
          </span>
          <span>
            <Scale size={14} /> {decision.outcome}
          </span>
          {decision.flags.map((flag) => (
            <span key={flag} className="proof-flag">
              ⚠ {flag}
            </span>
          ))}
        </div>
      </div>
      <div className="proof-doc" ref={docRef}>
        <svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">
          <rect className="bounding" x="8" y="8" width="304" height="42" />
          <rect className="bounding second" x="8" y="60" width="210" height="34" />
          <rect className="bounding third" x="8" y="104" width="270" height="38" />
        </svg>
        <div className="doc-lines">
          <span>RECONCILED SOURCE EVIDENCE · {selectedSources.length} selected field(s)</span>
          <span>{selectedSources[0] ? `${selectedSources[0].field} = ${String(selectedSources[0].value)}` : "No selected source evidence"}</span>
          <span>{decision.excluded_delay_days ? `excluded accused delay = ${decision.excluded_delay_days} days` : "no accused delay excluded"}</span>
          <span>threshold computation = rule v{decision.rule_version}</span>
        </div>
      </div>
      <div className="source-grid">
        {sources.length > 0 ? sources.slice(0, 4).map((source) => (
          <div key={`${source.field}-${source.label}-${String(source.value)}`}>
            <span className={`src-dot ${source.selected ? "selected" : ""}`} />
            {source.label} <b>{Math.round(source.confidence * 100)}%</b>
          </div>
        )) : <div><span className="src-dot" /> No reconciled sources recorded</div>}
      </div>
      <p className="disclaimer">
        Decision support only. A designated legal officer must verify source documents before action.
      </p>
    </section>
  );
}
