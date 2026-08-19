"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Printer,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { api, type CaseBundle, type ProofCardPayload } from "../../../lib/api";
import {
  FormAModal,
  GoldenTestBadge,
  PageShell,
  ProofCard,
  RuleChecklist,
  SkeletonCard,
  SourceConflictPanel,
  StatusBadge,
  WorkflowRail,
} from "../../components";

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const caseId = params?.id ?? "CASE-1042";
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [proof, setProof] = useState<ProofCardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormAOpen, setIsFormAOpen] = useState(false);

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

  const { case: record, prisoner, decision, workflow, conflicts } = bundle;
  const facts = [
    { label: "Detention served", value: decision.detention_days !== null ? `${decision.detention_days} days` : "—" },
    { label: "Qualifying custody", value: decision.qualifying_detention_days !== null ? `${decision.qualifying_detention_days} days` : "—" },
    { label: "Section 479 threshold", value: decision.threshold_days !== null ? `${decision.threshold_days} days` : "—" },
    { label: "Days remaining", value: decision.days_remaining !== null ? `${decision.days_remaining} days` : "—" },
    { label: "First-time offender", value: record.first_time_offender === true ? "Verified (1/3)" : record.first_time_offender === false ? "No (1/2)" : "Not provided" },
  ];

  return (
    <PageShell eyebrow="CASE INTELLIGENCE" title={`${prisoner.name} · ${caseId}`} breadcrumbs={breadcrumbs}>
      {/* Top Action & Compliance Ribbon */}
      <div className="case-top-actions-ribbon">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <GoldenTestBadge />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginLeft: "auto" }}>
          <button
            type="button"
            className="primary form-a-btn"
            onClick={() => setIsFormAOpen(true)}
            title="Generate official printable S.479 Form-A Bail Application"
          >
            <FileSpreadsheet size={16} /> Generate S.479 Form-A Bail Memo (PDF)
          </button>
        </div>
      </div>

      {/* Row 1: Eligibility Signal + Four-Eye Workflow */}
      <div className="detail-grid" style={{ marginBottom: "24px" }}>
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

        {workflow && <WorkflowRail levels={workflow.levels} nextAction={workflow.next_action} />}
      </div>

      {/* Row 2: B1 Hard Wall Split — Zone 1 (AI Perception) vs Zone 2 (Statutory Rule Engine) */}
      <div className="detail-grid" style={{ marginBottom: "24px" }}>
        <ProofCard
          decision={decision}
          sources={proof?.sources}
          documentLines={bundle.document_lines}
          perceptionInfo={bundle.perception_info}
        />
        <RuleChecklist decision={decision} />
      </div>

      {/* Row 3: B3 Source Conflict Reconciliation Panel (Truth Hierarchy 3-Column Diff) */}
      <SourceConflictPanel conflictData={conflicts} caseId={caseId} />

      {/* B4: Printable S.479 Form-A Bail Petition Modal */}
      <FormAModal
        isOpen={isFormAOpen}
        onClose={() => setIsFormAOpen(false)}
        bundle={bundle}
        proof={proof}
      />
    </PageShell>
  );
}
