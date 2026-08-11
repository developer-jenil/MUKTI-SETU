"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import { api, type CaseBundle, type ProofCardPayload } from "../../../lib/api";
import {
  PageShell, ProofCard, RuleChecklist, SkeletonCard, StatusBadge, WorkflowRail,
} from "../../components";

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const caseId = params?.id ?? "CASE-1042";
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [proof, setProof] = useState<ProofCardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBundle(null);
    setProof(null);
    setError(null);
    api.case(caseId).then(setBundle).catch((err) => setError(err.message));
    api.proofCard(caseId).then(setProof).catch(() => setProof(null));
  }, [caseId]);

  const breadcrumbs = [
    { label: "Casework", href: "/" },
    { label: caseId },
  ];

  if (error) {
    return (
      <PageShell eyebrow="CASE INTELLIGENCE" title={caseId} breadcrumbs={breadcrumbs}>
        <div className="api-error">Could not load case: {error}</div>
      </PageShell>
    );
  }

  if (!bundle) {
    return (
      <PageShell eyebrow="CASE INTELLIGENCE" title={caseId} breadcrumbs={breadcrumbs}>
        <div className="detail-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </PageShell>
    );
  }

  const { case: record, prisoner, decision, workflow } = bundle;
  const facts = [
    { label: "Detention served", value: decision.detention_days !== null ? `${decision.detention_days} days` : "—" },
    { label: "Qualifying custody", value: decision.qualifying_detention_days !== null ? `${decision.qualifying_detention_days} days` : "—" },
    { label: "Section 479 threshold", value: decision.threshold_days !== null ? `${decision.threshold_days} days` : "—" },
    { label: "Days remaining", value: decision.days_remaining !== null ? `${decision.days_remaining} days` : "—" },
    { label: "First-time offender", value: record.first_time_offender === true ? "Verified" : record.first_time_offender === false ? "No" : "Not provided" },
  ];

  const latestDoc = record.documents_list && record.documents_list.length > 0 ? record.documents_list[record.documents_list.length - 1] : null;

  return (
    <PageShell eyebrow="CASE INTELLIGENCE" title={`${prisoner.name} · ${caseId}`} breadcrumbs={breadcrumbs}>
      <div className="detail-grid">
        <section className="panel">
          <p className="eyebrow">ELIGIBILITY SIGNAL</p>
          <div className="decision">
            <BadgeCheck />
            <div>
              <strong>{decision.outcome.replace(/_/g, " ")}</strong>
              <span>{decision.legal_basis} · {decision.reasons[0]}</span>
            </div>
          </div>
          <div className="fact-grid">
            {facts.map((fact) => (
              <div key={fact.label}>
                <small>{fact.label}</small>
                <b>{fact.value}</b>
              </div>
            ))}
          </div>
          <div className="decision-foot">
            <StatusBadge status={decision.status} />
            {decision.flags.map((flag) => (
              <span key={flag} className="flag-pill">⚠ {flag}</span>
            ))}
            <Link className="primary" style={{ marginLeft: "auto", textDecoration: "none" }} href={`/workflow?case_id=${caseId}`}>
              Start human review <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">SOURCE TRUTH</p>
          {latestDoc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="source">
                <FileText />
                <span>
                  <b>Uploaded Document: {latestDoc.filename}</b>
                  <small>FIR: {latestDoc.fir_number ?? record.fir_number} · Classification: {latestDoc.adjournment?.classification ?? "COURT_DELAY"}</small>
                </span>
                <span className={`pill ${latestDoc.requires_human_review ? "warn" : "ok"}`}>
                  {latestDoc.requires_human_review ? "HUMAN REVIEW REQUIRED" : "OK"}
                </span>
              </div>
              {latestDoc.text_preview && (
                <div className="proof-doc" style={{ marginTop: "8px" }}>
                  <div className="doc-lines">
                    <span>EXTRACTED TEXT PREVIEW · {latestDoc.filename}</span>
                    <span>{latestDoc.text_preview}</span>
                  </div>
                </div>
              )}
            </div>
          ) : proof?.sources.length ? (
            proof.sources.map((source) => (
              <div key={`${source.field}-${source.label}-${String(source.value)}`} className={`source ${source.requires_human_review ? "warning" : ""}`}>
                {source.requires_human_review ? <AlertTriangle /> : <FileText />}
                <span>
                  <b>{source.label} · {source.field}</b>
                  <small>{String(source.value)} · {Math.round(source.confidence * 100)}% confidence</small>
                </span>
                {source.selected ? <BadgeCheck /> : <AlertTriangle />}
              </div>
            ))
          ) : (
            <div className="source warning">
              <AlertTriangle />
              <span>
                <b>No reconciled source evidence</b>
                <small>Manual verification required before action.</small>
              </span>
            </div>
          )}
        </section>
      </div>

      <div className="detail-grid">
        {workflow && <WorkflowRail levels={workflow.levels} nextAction={workflow.next_action} />}
        <ProofCard decision={decision} sources={proof?.sources} />
      </div>

      <RuleChecklist decision={decision} />
    </PageShell>
  );
}
