"use client";

import { useState } from "react";
import {
  Award,
  CheckCircle2,
  FileCheck,
  Gavel,
  Scale,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import type { CaseBundle } from "../../lib/api";

export function UTRCBenchView({ bundle }: { bundle: CaseBundle }) {
  const { case: record, prisoner, decision } = bundle;
  const isEligible = decision.status === "ELIGIBLE" || decision.status === "ELIGIBLE_FLAGGED";

  // Individual 3-Member concurrence states
  const [judgeApproved, setJudgeApproved] = useState(isEligible);
  const [prosecutorApproved, setProsecutorApproved] = useState(!record.punishable_by_death_or_life && !record.multiple_pending_cases);
  const [dlsaApproved, setDlsaApproved] = useState(true);
  const [personalBondOnly, setPersonalBondOnly] = useState(record.first_time_offender);

  const allApproved = judgeApproved && prosecutorApproved && dlsaApproved;

  return (
    <section className="panel utrc-bench-panel" aria-label="Under Trial Review Committee 3-Member Bench Mode">
      <div className="bench-header">
        <div>
          <p className="eyebrow" style={{ color: "var(--cyan)", marginBottom: 4 }}>
            UNDER TRIAL REVIEW COMMITTEE (UTRC) · 3-MEMBER STATUTORY BENCH
          </p>
          <h3 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Users size={20} className="text-cyan" />
            Joint Statutory Review Hearing Mode
          </h3>
        </div>

        <div className="bench-seal-badge">
          <Shield size={16} />
          <span>UTRC BENCH IN SESSION · SOP COMPLIANT</span>
        </div>
      </div>

      <p style={{ fontSize: "13px", color: "var(--muted)", margin: "10px 0 16px", lineHeight: 1.5 }}>
        Under Supreme Court of India guidelines (In Re: Policy Strategy for Grant of Bail, SMWP(Crl) 4/2021) and Section 479 BNSS, decisions are reviewed quarterly by the 3-member Under Trial Review Committee.
      </p>

      {/* 3-Member Column Grid */}
      <div className="utrc-members-grid">
        {/* Member 1: Judicial Officer / CJM (Chairperson) */}
        <div className={`bench-member-card ${judgeApproved ? "approved" : "pending"}`}>
          <div className="member-top">
            <div className="member-avatar judge">
              <Gavel size={18} />
            </div>
            <div>
              <small className="member-role">CHAIRPERSON / BENCH HEAD</small>
              <b className="member-title">Principal District Judge / CJM</b>
            </div>
            <span className={`pill ${judgeApproved ? "ok" : "warn"}`}>
              {judgeApproved ? "CONCURRED" : "PENDING"}
            </span>
          </div>

          <div className="member-body">
            <div className="member-item">
              <small>Constitutional Mandate</small>
              <span>Article 21 Right to Speedy Trial & BNSS S.479 Compliance</span>
            </div>
            <div className="member-item">
              <small>Statutory Finding</small>
              <b>{decision.outcome.replace(/_/g, " ")}</b>
            </div>
            <div className="member-item">
              <small>Recommended Bond Condition</small>
              <span>{personalBondOnly ? "Personal Recognizance Bond (No Cash Surety)" : "Surety Bond ₹15,000"}</span>
            </div>
          </div>

          <div className="member-foot">
            <label className="checkbox-wrap">
              <input
                type="checkbox"
                checked={judgeApproved}
                onChange={(e) => setJudgeApproved(e.target.checked)}
              />
              <span>Sign Judicial Order for Bail</span>
            </label>
          </div>
        </div>

        {/* Member 2: Public Prosecutor */}
        <div className={`bench-member-card ${prosecutorApproved ? "approved" : "pending"}`}>
          <div className="member-top">
            <div className="member-avatar prosecutor">
              <Scale size={18} />
            </div>
            <div>
              <small className="member-role">STATE REPRESENTATIVE</small>
              <b className="member-title">District Public Prosecutor</b>
            </div>
            <span className={`pill ${prosecutorApproved ? "ok" : "warn"}`}>
              {prosecutorApproved ? "NO OBJECTION" : "SCRUTINY"}
            </span>
          </div>

          <div className="member-body">
            <div className="member-item">
              <small>Heinous / Capital Crime Check</small>
              <span>{record.punishable_by_death_or_life ? "⚠ Death / Life Imprisonment Bar" : "✓ Non-capital charge"}</span>
            </div>
            <div className="member-item">
              <small>Pending Prosecutions in Other Courts</small>
              <span>{record.multiple_pending_cases ? "⚠ Multiple Cases Found" : "✓ Single Trial Confirmed"}</span>
            </div>
            <div className="member-item">
              <small>Adjournment Delay Concession</small>
              <span>{decision.excluded_delay_days ? `${decision.excluded_delay_days} days contested delay` : "Zero defense delay recorded"}</span>
            </div>
          </div>

          <div className="member-foot">
            <label className="checkbox-wrap">
              <input
                type="checkbox"
                checked={prosecutorApproved}
                onChange={(e) => setProsecutorApproved(e.target.checked)}
              />
              <span>State No-Objection Certificate</span>
            </label>
          </div>
        </div>

        {/* Member 3: DLSA Secretary / Legal Aid Counsel */}
        <div className={`bench-member-card ${dlsaApproved ? "approved" : "pending"}`}>
          <div className="member-top">
            <div className="member-avatar dlsa">
              <UserCheck size={18} />
            </div>
            <div>
              <small className="member-role">LEGAL AID DEFENDER</small>
              <b className="member-title">Secretary, DLSA / Legal Aid</b>
            </div>
            <span className={`pill ${dlsaApproved ? "ok" : "warn"}`}>
              {dlsaApproved ? "PETITION FILED" : "PENDING"}
            </span>
          </div>

          <div className="member-body">
            <div className="member-item">
              <small>Indigent Undertrial Status</small>
              <span>Verified Eligible for Free Legal Aid Representation</span>
            </div>
            <div className="member-item">
              <small>Offender Classification</small>
              <b>{record.first_time_offender ? "First-Timer (1/3 Fraction)" : "Standard (1/2 Fraction)"}</b>
            </div>
            <div className="member-item">
              <small>Form-A Statutory Bail Memo</small>
              <span>Generated & Document Anchors Attached</span>
            </div>
          </div>

          <div className="member-foot">
            <label className="checkbox-wrap">
              <input
                type="checkbox"
                checked={dlsaApproved}
                onChange={(e) => setDlsaApproved(e.target.checked)}
              />
              <span>Counsel Certification Signed</span>
            </label>
          </div>
        </div>
      </div>

      {/* Joint Committee Final Resolution Box */}
      <div className={`bench-disposition-box ${allApproved ? "approved" : "partial"}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {allApproved ? (
            <ShieldCheck size={26} className="text-mint flex-shrink-0" />
          ) : (
            <FileCheck size={26} className="text-amber flex-shrink-0" />
          )}
          <div>
            <b style={{ fontSize: "14px", display: "block" }}>
              {allApproved
                ? "UNANIMOUS COMMITTEE RECOMMENDATION: GRANT S.479 STATUTORY BAIL"
                : "PENDING CONCURRENCE: 3-MEMBER SIGN-OFF INCOMPLETE"}
            </b>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
              {allApproved
                ? `Resolution recorded for ${prisoner.name} (${record.id}). Forwarded to Trial Court for formal release on personal recognizance bond.`
                : "All three bench members (Judge, Prosecutor, Legal Aid) must record concurrence before the statutory resolution is sealed."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          <button
            type="button"
            className="primary"
            disabled={!allApproved}
            style={{ opacity: allApproved ? 1 : 0.6 }}
            onClick={() => alert(`UTRC Order formally approved and sealed for ${prisoner.name} (${record.id}) under Section 479 BNSS.`)}
          >
            <Award size={15} /> Issue UTRC Minute & Bond Order
          </button>
        </div>
      </div>
    </section>
  );
}
