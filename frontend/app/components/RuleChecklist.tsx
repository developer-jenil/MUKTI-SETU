"use client";

import { useEffect, useRef } from "react";
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
      { opacity: 1, x: 0, scale: 1, stagger: 0.32, duration: 0.4, ease: "power2.out", delay: 0.2 }
    );
  }, [decision]);

  return (
    <section className="panel checklist-panel">
      <p className="eyebrow">AUDITABLE RULE TRACE</p>
      <h3>Rule engine checklist</h3>
      <ol ref={listRef} className="checklist">
        {decision.trace.map((step) => {
          const ok = step.result !== "BLOCK" && step.result !== "FAIL" && step.result !== "TRIGGER";
          return (
            <li className="check-item" key={step.step}>
              <span className={`stamp ${ok ? "ok" : "no"}`}>{ok ? "✓" : "⚠"}</span>
              <div>
                <b>{step.step}</b>
                <small>{step.detail}</small>
              </div>
              <span className={`check-result ${ok ? "pass" : "warn"}`}>{step.result}</span>
            </li>
          );
        })}
      </ol>
      {decision.exclusions.length > 0 && (
        <p className="exclusion-note">Excluded by: {decision.exclusions.join(", ")}</p>
      )}
      {decision.flags.length > 0 && (
        <p className="exclusion-note flag">Flagged: {decision.flags.join(", ")}</p>
      )}
    </section>
  );
}
