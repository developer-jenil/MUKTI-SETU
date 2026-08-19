"use client";

import { useEffect, useRef } from "react";
import { Calculator, CheckCircle2, Cpu, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import gsap from "gsap";
import type { Decision } from "../../lib/api";

export function RuleChecklist({ decision }: { decision: Decision }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".check-item");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => ((el as HTMLElement).style.opacity = "1"));
      return;
    }
    gsap.fromTo(
      items,
      { opacity: 0, x: -14, scale: 0.97 },
      { opacity: 1, x: 0, scale: 1, stagger: 0.25, duration: 0.4, ease: "power2.out", delay: 0.15 }
    );
  }, [decision]);

  // Fraction determination for deterministic display
  const isFirstTime = decision.legal_basis?.includes("First Proviso") || decision.trace.some((t) => t.detail?.includes("1/3"));
  const appliedFraction = isFirstTime ? "1/3 Fraction (First-Time Offender Proviso)" : "1/2 Fraction (Standard Clause)";

  return (
    <section className="panel checklist-panel zone-emerald-wall" aria-label="Statutory Rule Engine Trace">
      {/* Zone 2 Emerald Hard Wall Header */}
      <div className="zone-wall-header emerald">
        <div className="zone-tag">
          <ShieldCheck size={15} />
          <span>ZONE 2: STATUTORY RULE ENGINE — 100% DETERMINISTIC · BNSS S.479</span>
        </div>
        <span className="deterministic-pill">
          Deterministic Execution · Rule v{decision.rule_version}
        </span>
      </div>

      <div className="zone-meta-strip emerald">
        <span><b>Engine:</b> Python/YAML S.479 Engine</span>
        <span><b>Legal Basis:</b> {decision.legal_basis}</span>
        <span className="math-tag"><Cpu size={13} /> Zero-Hallucination Math</span>
      </div>

      {/* Custody-Fraction Math Breakdown (No % Confidence Value Anywhere) */}
      <div className="custody-fraction-card">
        <div className="fraction-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calculator size={15} className="text-mint" />
            <b>STATUTORY CUSTODY MATH (BNSS SECTION 479)</b>
          </div>
          <span className="fraction-badge">{appliedFraction}</span>
        </div>

        <div className="fraction-grid">
          <div className="f-box">
            <small>Total Served</small>
            <b>{decision.detention_days ?? "—"} Days</b>
          </div>
          <div className="f-box">
            <small>Accused Delay Excluded</small>
            <b>{decision.excluded_delay_days ?? 0} Days</b>
          </div>
          <div className="f-box">
            <small>Qualifying Custody</small>
            <b>{decision.qualifying_detention_days ?? decision.detention_days ?? "—"} Days</b>
          </div>
          <div className="f-box highlight">
            <small>Statutory Threshold</small>
            <b>{decision.threshold_days ?? "—"} Days</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "18px", marginBottom: "10px" }}>
        <p className="eyebrow" style={{ color: "var(--mint)", marginBottom: 4 }}>AUDITABLE STATUTORY RULE TRACE</p>
        <h3 style={{ fontSize: "18px", margin: 0 }}>Deterministic Evaluation Checklist</h3>
      </div>

      <ol ref={listRef} className="checklist">
        {decision.trace.map((step, idx) => {
          const ok = step.result !== "BLOCK" && step.result !== "FAIL" && step.result !== "TRIGGER";
          return (
            <li className="check-item" key={`${step.step}-${idx}`}>
              <span className={`stamp ${ok ? "ok" : "no"}`}>{ok ? "✓" : "⚠"}</span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: "13px" }}>{step.step}</b>
                <small style={{ fontSize: "12px", color: "var(--muted)" }}>{step.detail}</small>
              </div>
              <span className={`check-result ${ok ? "pass" : "warn"}`}>{step.result}</span>
            </li>
          );
        })}
      </ol>

      {decision.exclusions.length > 0 && (
        <p className="exclusion-note">Statutory Exclusion Applied: {decision.exclusions.join(", ")}</p>
      )}
      {decision.flags.length > 0 && (
        <p className="exclusion-note flag">Statutory Review Flags: {decision.flags.join(", ")}</p>
      )}

      <p className="disclaimer" style={{ marginTop: "14px" }}>
        <b>Statutory Guarantee:</b> Evaluated in strict priority order against YAML rules without probabilistic approximations.
      </p>
    </section>
  );
}
