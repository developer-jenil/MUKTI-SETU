"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { api, type Decision } from "../../lib/api";
import { PageShell, SkeletonCard } from "../components";

export default function SimulatorPage() {
  const [years, setYears] = useState(3);
  const [days, setDays] = useState(365);
  const [first, setFirst] = useState(true);
  const [accusedDelayDays, setAccusedDelayDays] = useState(0);
  const [delayConfirmed, setDelayConfirmed] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDecision(null);
    setError(null);
    api
      .simulate({
        maximum_sentence_years: years,
        detention_days: days,
        first_time_offender: first,
        accused_delay_days: accusedDelayDays,
        accused_delay_confirmed: delayConfirmed,
        accused_delay_source: accusedDelayDays > 0 ? "manual-review" : undefined,
      })
      .then(setDecision)
      .catch((err) => setError(err.message));
  }, [years, days, first, accusedDelayDays, delayConfirmed]);

  useEffect(() => {
    if (!barRef.current || !decision) return;
    const qualifyingDays = decision.qualifying_detention_days ?? days;
    const percent = Math.min((qualifyingDays / (decision.threshold_days || 1)) * 100, 100);
    const scale = percent / 100;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(barRef.current, { scaleX: scale });
      return;
    }
    gsap.fromTo(barRef.current, { scaleX: 0 }, { scaleX: scale, duration: 0.9, ease: "power3.out" });
  }, [decision, days]);

  const flagged = decision?.status === "ELIGIBLE_FLAGGED";

  const breadcrumbs = [
    { label: "Rule Sandbox" },
  ];

  return (
    <PageShell eyebrow="RULE SANDBOX" title="Explain the threshold." breadcrumbs={breadcrumbs}>
      <div className="detail-grid">
        <section className="panel form">
          <div className="preset-group">
            <span className="eyebrow" style={{ flexBasis: "100%", marginBottom: 6 }}>QUICK SENTENCE PRESETS</span>
            <button className="preset-btn" onClick={() => { setYears(3); setDays(365); }}>3 Years (1/3 = 1 year)</button>
            <button className="preset-btn" onClick={() => { setYears(7); setDays(850); }}>7 Years (1/3 = 852 days)</button>
            <button className="preset-btn" onClick={() => { setYears(10); setDays(1800); }}>10 Years (1/3 = 3.3 yrs)</button>
          </div>

          <label htmlFor="sentence-range">
            Maximum sentence <span>{years} years</span>
            <input
              id="sentence-range"
              type="range"
              min="1"
              max="20"
              value={years}
              aria-label="Maximum sentence in years"
              onChange={(event) => setYears(Number(event.target.value))}
            />
          </label>

          <label htmlFor="detention-days">
            Days in pre-trial custody
            <input
              id="detention-days"
              type="number"
              min="0"
              max="2000"
              value={days}
              aria-label="Days in pre-trial custody"
              onChange={(event) => setDays(Number(event.target.value))}
            />
          </label>

          <label className="check" htmlFor="first-time-check">
            <input
              id="first-time-check"
              type="checkbox"
              checked={first}
              aria-label="First-time offender check"
              onChange={(event) => setFirst(event.target.checked)}
            />
            First-time offender (1/3 threshold applied)
          </label>

          <label htmlFor="accused-delay-days">
            Accused-caused delay days <span>{accusedDelayDays} days</span>
            <input
              id="accused-delay-days"
              type="number"
              min="0"
              max={days}
              value={accusedDelayDays}
              aria-label="Accused-caused delay days"
              onChange={(event) => setAccusedDelayDays(Math.min(Number(event.target.value), days))}
            />
          </label>

          <label className="check" htmlFor="delay-confirmed-check">
            <input
              id="delay-confirmed-check"
              type="checkbox"
              checked={delayConfirmed}
              disabled={accusedDelayDays === 0}
              aria-label="Confirm accused-caused delay"
              onChange={(event) => setDelayConfirmed(event.target.checked)}
            />
            Human reviewer confirmed source evidence
          </label>
        </section>

        <section className="panel simulation">
          <p className="eyebrow">DETERMINISTIC RESULT</p>
          {error && <div className="api-error">{error}</div>}
          {!decision && !error && <SkeletonCard />}
          {decision && (
            <>
              <strong className={flagged ? "flagged" : ""}>
                {flagged ? "ELIGIBLE — FLAGGED" : decision.status.replace(/_/g, " ")}
              </strong>
              <h2>{decision.threshold_days ?? "—"} days</h2>
              <p>{decision.legal_basis} · {decision.reasons[0]}</p>
              <div className="sim-meter">
                <div className="sim-track">
                  <div className="sim-fill" ref={barRef} />
                </div>
                <span className="sim-marker" style={{ left: "50%" }} />
                <div className="sim-labels">
                  <span>0 days</span>
                  <span>{decision.qualifying_detention_days ?? days} qualifying days</span>
                  <span>threshold</span>
                </div>
              </div>
              <small>
                Capital/life offences and multiple pending cases must be checked separately — the engine excludes them before any threshold applies.
              </small>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
