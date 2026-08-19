"use client";

import { AlertTriangle, BadgeCheck, CheckCircle2, GitCompare, HelpCircle, Layers, ShieldAlert, ShieldCheck } from "lucide-react";
import type { SourceConflictData } from "../../lib/api";

const DEFAULT_HIERARCHY = [
  { source: "Court Remand Order Sheet", weight: 1.0, rank: "1st (Adjudicating)" },
  { source: "e-Prisons Central Register", weight: 0.95, rank: "2nd (Factual)" },
  { source: "Police FIR / CCTNS Record", weight: 0.85, rank: "3rd (Corroborating)" },
  { source: "OCR / AI Document Extraction", weight: 0.75, rank: "4th (Probabilistic)" },
];

export function SourceConflictPanel({
  conflictData,
  caseId,
}: {
  conflictData?: SourceConflictData;
  caseId?: string;
}) {
  const hasConflict = conflictData?.has_conflict ?? false;
  const columns = conflictData?.columns ?? [
    {
      source_name: "e-Prisons Register",
      authority: "Central Prison Admission Log",
      recorded_value: "Continuous Custody: 412 Days",
      detention_days: 412,
      reliability_score: 0.95,
      status: "PRIMARY",
      notes: "Biometric intake record matches court remand without interruption.",
    },
    {
      source_name: "Court Remand Sheet",
      authority: "Principal Sessions Court Order",
      recorded_value: "Qualifying Custody: 412 Days",
      detention_days: 412,
      reliability_score: 1.0,
      status: "PRIMARY",
      notes: "Judicial order sheets corroborate 412 days continuous pre-trial custody.",
    },
    {
      source_name: "Police FIR / CCTNS",
      authority: "State CCTNS Criminal Database",
      recorded_value: "FIR Log: 412 Days",
      detention_days: 412,
      reliability_score: 0.85,
      status: "CORROBORATING",
      notes: "Single pending FIR record confirmed with zero companion proceedings.",
    },
  ];

  return (
    <section className={`panel conflict-panel ${hasConflict ? "conflict-active" : "reconciled"}`} aria-label="Source Conflict Reconciliation Matrix">
      <div className="panel-head conflict-head">
        <div>
          <p className="eyebrow" style={{ color: hasConflict ? "var(--amber)" : "var(--mint)", marginBottom: 4 }}>
            MULTI-SOURCE TRUTH RECONCILIATION
          </p>
          <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GitCompare size={20} className={hasConflict ? "text-amber" : "text-mint"} />
            Cross-Repository Truth Concordance
          </h3>
        </div>
        <span className={`status-pill conflict-badge ${hasConflict ? "warn" : "ok"}`}>
          {hasConflict ? (
            <>
              <ShieldAlert size={14} /> CONFLICT FLAGGED (ARTICLE 21)
            </>
          ) : (
            <>
              <ShieldCheck size={14} /> 100% RECONCILED CONCORDANCE
            </>
          )}
        </span>
      </div>

      {/* Truth Hierarchy Strip */}
      <div className="truth-hierarchy-strip">
        <span className="hierarchy-title">
          <Layers size={13} /> STATUTORY TRUTH HIERARCHY:
        </span>
        <div className="hierarchy-pills">
          {DEFAULT_HIERARCHY.map((item, idx) => (
            <span key={item.source} className="hierarchy-pill" title={`Priority ${item.rank} with weight ${item.weight}`}>
              <span className="h-num">{idx + 1}</span>
              <span className="h-name">{item.source}</span>
              <span className="h-weight">({item.weight.toFixed(2)})</span>
            </span>
          ))}
        </div>
      </div>

      {/* 3-Column Diff Card */}
      <div className="conflict-columns-grid">
        {columns.map((col) => {
          const isContested = col.status === "CONTESTED";
          return (
            <div
              key={col.source_name}
              className={`conflict-col-card ${isContested ? "contested" : "aligned"}`}
            >
              <div className="col-top">
                <div>
                  <small className="col-authority">{col.authority}</small>
                  <b className="col-name">{col.source_name}</b>
                </div>
                <span className={`pill ${isContested ? "warn" : "ok"}`}>
                  {isContested ? "CONTESTED" : "CONFIRMED"}
                </span>
              </div>

              <div className="col-value-box">
                <span className="val-label">Recorded Custody Duration:</span>
                <strong className="val-number">{col.recorded_value}</strong>
                <span className="val-weight">Reliability Weight: {col.reliability_score.toFixed(2)}</span>
              </div>

              <p className="col-notes">{col.notes}</p>
            </div>
          );
        })}
      </div>

      {/* Resolution State Action Banner */}
      <div className={`conflict-resolution-banner ${hasConflict ? "warn" : "ok"}`}>
        {hasConflict ? (
          <>
            <AlertTriangle size={18} className="text-amber flex-shrink-0" />
            <div>
              <b>Disputed Adjournment Attribution Detected ({caseId || "CASE"})</b>
              <p>
                {conflictData?.resolution_action ||
                  "CONFLICT FLAGGED → routed for Magistrate adjudication (Article 21). Excluded delay period is contested by defense counsel."}
              </p>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 size={18} className="text-mint flex-shrink-0" />
            <div>
              <b>Zero Source Discrepancy Recorded</b>
              <p>All official repositories (e-Prisons, Court Remand, Police CCTNS) match in 100% agreement. Case verified for deterministic rule calculation.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
