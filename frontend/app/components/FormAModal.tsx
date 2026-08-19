"use client";

import { useRef } from "react";
import { Check, Download, FileSpreadsheet, Printer, Scale, Shield, X } from "lucide-react";
import type { CaseBundle, ProofCardPayload } from "../../lib/api";

export function FormAModal({
  isOpen,
  onClose,
  bundle,
  proof,
}: {
  isOpen: boolean;
  onClose: () => void;
  bundle: CaseBundle;
  proof?: ProofCardPayload | null;
}) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const { case: record, prisoner, decision } = bundle;
  const isEligible = decision.status === "ELIGIBLE" || decision.status === "ELIGIBLE_FLAGGED";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="forma-title">
      <div className="command-modal form-a-modal-wrap">
        <div className="form-a-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileSpreadsheet className="text-cyan" size={20} />
            <b id="forma-title" style={{ fontSize: "15px" }}>STATUTORY BAIL PETITION PREVIEW · FORM-A (BNSS S.479)</b>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="primary btn-sm" onClick={handlePrint}>
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button type="button" className="icon-btn-sm" onClick={onClose} aria-label="Close Form-A modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Form-A Sheet */}
        <div className="form-a-print-sheet" ref={printAreaRef}>
          {/* Official Letterhead */}
          <div className="forma-header">
            <div className="forma-emblem">
              <Shield size={26} />
            </div>
            <div className="forma-title-block">
              <h3>NATIONAL LEGAL SERVICES AUTHORITY (NALSA)</h3>
              <p>DISTRICT LEGAL SERVICES AUTHORITY (DLSA) · PRISON LEGAL AID CLINIC</p>
              <h4>MEMORANDUM OF APPLICATION UNDER SECTION 479 BNSS, 2023</h4>
              <small>(Bail Review for Under Trial Prisoner after Expiry of Specified Detention Fraction)</small>
            </div>
          </div>

          <hr className="forma-divider" />

          {/* Court & Case Metadata */}
          <div className="forma-section">
            <div className="forma-grid-2">
              <div>
                <b>BEFORE:</b> The Under Trial Review Committee (UTRC) / Chief Judicial Magistrate
              </div>
              <div style={{ textAlign: "right" }}>
                <b>DATE OF APPLICATION:</b> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="forma-grid-2" style={{ marginTop: "10px" }}>
              <div><b>IN THE MATTER OF:</b> State of {prisoner.state} vs. {prisoner.name}</div>
              <div style={{ textAlign: "right" }}><b>CASE NO:</b> {record.id} · <b>FIR:</b> {record.fir_number}</div>
            </div>
          </div>

          {/* Undertrial Particulars Table */}
          <table className="forma-table">
            <thead>
              <tr>
                <th colSpan={4}>PART I: UNDER TRIAL PRISONER PARTICULARS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Prisoner Name:</b></td>
                <td>{prisoner.name} (Age: {prisoner.age}, {prisoner.gender})</td>
                <td><b>Prison ID / Number:</b></td>
                <td>{prisoner.prison_number} ({prisoner.prison_name})</td>
              </tr>
              <tr>
                <td><b>Offences Charged:</b></td>
                <td>{record.sections.join(", ")}</td>
                <td><b>Maximum Sentence:</b></td>
                <td>{record.maximum_sentence_years} Years Rigorous Imprisonment</td>
              </tr>
              <tr>
                <td><b>First-Time Offender:</b></td>
                <td>{record.first_time_offender ? "YES (1/3 Proviso Applicable)" : "NO (1/2 Standard Clause Applicable)"}</td>
                <td><b>Multiple Proceedings:</b></td>
                <td>{record.multiple_pending_cases ? "YES" : "NO (Single Trial Verified)"}</td>
              </tr>
              <tr>
                <td><b>Date of Remand:</b></td>
                <td>{record.custody_start}</td>
                <td><b>Continuous Custody:</b></td>
                <td><b>{decision.detention_days ?? "—"} Days</b></td>
              </tr>
            </tbody>
          </table>

          {/* Statutory Computation Table */}
          <table className="forma-table" style={{ marginTop: "14px" }}>
            <thead>
              <tr>
                <th colSpan={4}>PART II: STATUTORY CUSTODY COMPUTATION UNDER S.479 BNSS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Applied Fraction:</b></td>
                <td>{record.first_time_offender ? "One-Third (1/3) of Max Term" : "One-Half (1/2) of Max Term"}</td>
                <td><b>Statutory Threshold:</b></td>
                <td><b>{decision.threshold_days ?? "—"} Days</b></td>
              </tr>
              <tr>
                <td><b>Accused Delay Excluded:</b></td>
                <td>{decision.excluded_delay_days ?? 0} Days</td>
                <td><b>Qualifying Custody:</b></td>
                <td><b>{decision.qualifying_detention_days ?? decision.detention_days ?? "—"} Days</b></td>
              </tr>
              <tr>
                <td><b>Compliance Outcome:</b></td>
                <td colSpan={3}>
                  <b style={{ color: isEligible ? "#0d6832" : "#991b1b" }}>
                    {decision.outcome.replace(/_/g, " ")} ({decision.status})
                  </b>
                  <br />
                  <small>{decision.reasons[0]}</small>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Part III: Rule Trace Audit */}
          <div className="forma-section" style={{ marginTop: "14px" }}>
            <b>PART III: DETERMINISTIC STATUTORY TRACE SUMMARY</b>
            <ol className="forma-trace-list">
              {decision.trace.map((step, idx) => (
                <li key={idx}>
                  <b>{step.step}:</b> {step.detail} — <i>[{step.result}]</i>
                </li>
              ))}
            </ol>
          </div>

          {/* Part IV: Reconciled Evidence Sources */}
          {proof && proof.sources.length > 0 && (
            <div className="forma-section" style={{ marginTop: "10px" }}>
              <b>PART IV: RECONCILED EVIDENCE SOURCES (TRUTH DISCOVERY)</b>
              <ul className="forma-evidence-list">
                {proof.sources.map((src, idx) => (
                  <li key={idx}>
                    <b>{src.label}:</b> {String(src.value)} ({Math.round(src.confidence * 100)}% extraction verification)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Signatures & Seal */}
          <div className="forma-signatures">
            <div className="sign-box">
              <div className="sign-line" />
              <span>Advocate / Legal Aid Defense Counsel</span>
              <small>District Legal Services Authority (DLSA)</small>
            </div>
            <div className="sign-box">
              <div className="sign-line" />
              <span>Secretary / Judicial Officer</span>
              <small>Under Trial Review Committee (UTRC)</small>
            </div>
          </div>

          {/* Mandatory Sovereign Footer */}
          <div className="forma-foot">
            <p>
              <b>STATUTORY NOTICE:</b> Decision support document generated pursuant to Section 479 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023. Generated by MUKTI-SETU Legal Aid Intelligence Platform for official court review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
