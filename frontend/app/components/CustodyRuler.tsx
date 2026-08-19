"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Award, Calendar, CheckCircle2, Clock, Ruler, ShieldCheck } from "lucide-react";
import gsap from "gsap";
import type { Decision, CaseRecord } from "../../lib/api";

export function CustodyRuler({
  decision,
  record,
}: {
  decision: Decision;
  record: CaseRecord;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  const maxSentenceDays = Math.max(record.maximum_sentence_years * 365, 365);
  const rawDetentionDays = decision.detention_days ?? 0;
  const excludedDelayDays = decision.excluded_delay_days ?? 0;
  const qualifyingDays = decision.qualifying_detention_days ?? Math.max(rawDetentionDays - excludedDelayDays, 0);

  // Percentages relative to total maximum statutory term
  const oneThirdPct = 33.33;
  const oneHalfPct = 50.0;
  const qualifyingPct = Math.min(Math.max((qualifyingDays / maxSentenceDays) * 100, 0), 100);
  const excludedPct = Math.min(Math.max((excludedDelayDays / maxSentenceDays) * 100, 0), 100);
  const totalRawPct = Math.min(qualifyingPct + excludedPct, 100);

  const isFirstTime = record.first_time_offender;
  const appliedThresholdPct = isFirstTime ? oneThirdPct : oneHalfPct;
  const isEligible = qualifyingDays >= (decision.threshold_days ?? (isFirstTime ? maxSentenceDays / 3 : maxSentenceDays / 2));

  useEffect(() => {
    if (!barRef.current) return;
    const progressFill = barRef.current.querySelector(".ruler-qualifying-fill");
    const delayFill = barRef.current.querySelector(".ruler-delay-fill");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (progressFill) (progressFill as HTMLElement).style.width = `${qualifyingPct}%`;
      if (delayFill) (delayFill as HTMLElement).style.width = `${excludedPct}%`;
      return;
    }

    if (progressFill) {
      gsap.fromTo(
        progressFill,
        { width: "0%" },
        { width: `${qualifyingPct}%`, duration: 1.2, ease: "power3.out", delay: 0.2 }
      );
    }
    if (delayFill && excludedPct > 0) {
      gsap.fromTo(
        delayFill,
        { width: "0%" },
        { width: `${excludedPct}%`, duration: 0.9, ease: "power2.out", delay: 0.8 }
      );
    }
  }, [qualifyingPct, excludedPct]);

  return (
    <section className="panel custody-ruler-panel" aria-label="Section 479 Dual-Threshold Custody Ruler">
      <div className="ruler-header">
        <div>
          <p className="eyebrow" style={{ color: "var(--cyan)", marginBottom: 4 }}>
            DUAL-THRESHOLD STATUTORY CUSTODY RULER
          </p>
          <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Ruler size={18} className="text-cyan" />
            Section 479 Detention Progression Gauge
          </h3>
        </div>

        <div className="ruler-status-pill">
          {isEligible ? (
            <span className="pill ok" style={{ fontSize: "12px", padding: "4px 10px" }}>
              <CheckCircle2 size={14} /> THRESHOLD SURPASSED ({Math.round((qualifyingDays / (decision.threshold_days || 1)) * 100)}%)
            </span>
          ) : (
            <span className="pill warn" style={{ fontSize: "12px", padding: "4px 10px" }}>
              <Clock size={14} /> IN PROGRESS ({Math.round((qualifyingDays / (decision.threshold_days || 1)) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* The Interactive Horizontal Ruler Track */}
      <div className="ruler-track-wrapper">
        <div className="ruler-track" ref={barRef}>
          {/* 1/3 First-Time Offender Marker */}
          <div
            className={`ruler-threshold-line one-third ${isFirstTime ? "active-threshold" : ""}`}
            style={{ left: `${oneThirdPct}%` }}
          >
            <div className="threshold-tag">
              <span className="tag-fraction">1/3</span>
              <span className="tag-desc">First-Timer ({Math.round(maxSentenceDays / 3)}d)</span>
            </div>
          </div>

          {/* 1/2 General Undertrial Marker */}
          <div
            className={`ruler-threshold-line one-half ${!isFirstTime ? "active-threshold" : ""}`}
            style={{ left: `${oneHalfPct}%` }}
          >
            <div className="threshold-tag">
              <span className="tag-fraction">1/2</span>
              <span className="tag-desc">Standard ({Math.round(maxSentenceDays / 2)}d)</span>
            </div>
          </div>

          {/* Qualifying Custody Bar */}
          <div className="ruler-qualifying-fill" style={{ width: `${qualifyingPct}%` }}>
            <span className="ruler-pulse-dot" />
          </div>

          {/* Accused Delay Excluded Segment (Diagonal Stripes) */}
          {excludedDelayDays > 0 && (
            <div
              className="ruler-delay-fill"
              style={{
                left: `${qualifyingPct}%`,
                width: `${excludedPct}%`,
              }}
              title={`${excludedDelayDays} days accused-caused delay deducted under S.479(2)`}
            />
          )}
        </div>

        {/* Milestone Scale Numbers */}
        <div className="ruler-scale-labels">
          <span>0 Days (Remand)</span>
          <span style={{ left: `${oneThirdPct}%`, position: "absolute", transform: "translateX(-50%)" }}>
            1/3 ({Math.round(maxSentenceDays / 3)}d)
          </span>
          <span style={{ left: `${oneHalfPct}%`, position: "absolute", transform: "translateX(-50%)" }}>
            1/2 ({Math.round(maxSentenceDays / 2)}d)
          </span>
          <span>Max Term ({record.maximum_sentence_years} Yrs · {maxSentenceDays}d)</span>
        </div>
      </div>

      {/* Custody Breakdown Legend */}
      <div className="ruler-legend-grid">
        <div className="ruler-legend-card">
          <div className="legend-dot-label">
            <span className="legend-dot mint" />
            <small>Qualifying Custody Served</small>
          </div>
          <b>{qualifyingDays} Days</b>
          <span>{((qualifyingDays / maxSentenceDays) * 100).toFixed(1)}% of maximum statutory term</span>
        </div>

        {excludedDelayDays > 0 && (
          <div className="ruler-legend-card delay-alert">
            <div className="legend-dot-label">
              <span className="legend-dot stripes" />
              <small>Excluded Accused Delay</small>
            </div>
            <b style={{ color: "var(--amber)" }}>- {excludedDelayDays} Days</b>
            <span>Subtracted from qualifying custody under S.479(2)</span>
          </div>
        )}

        <div className="ruler-legend-card highlight">
          <div className="legend-dot-label">
            <span className="legend-dot cyan" />
            <small>Active Statutory Threshold ({isFirstTime ? "1/3 Proviso" : "1/2 Clause"})</small>
          </div>
          <b style={{ color: "var(--cyan)" }}>{decision.threshold_days ?? Math.round(maxSentenceDays / (isFirstTime ? 3 : 2))} Days</b>
          <span>
            {isEligible
              ? `${qualifyingDays - (decision.threshold_days ?? 0)} days overdue for release review`
              : `${(decision.threshold_days ?? 0) - qualifyingDays} days remaining until review maturity`}
          </span>
        </div>
      </div>
    </section>
  );
}
