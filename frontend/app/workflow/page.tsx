"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CircleDashed, LockKeyhole, RotateCcw, ShieldX } from "lucide-react";
import { api, type CaseBundle, type WorkflowLevel } from "../../lib/api";
import { PageShell, SkeletonCard } from "../components";

interface WorkflowView {
  levels: WorkflowLevel[];
  next_action: string;
  final_decision: string;
  events: Array<Record<string, unknown>>;
}

function WorkflowContent() {
  const searchParams = useSearchParams();
  const paramCaseId = searchParams.get("case_id");

  const [caseId, setCaseId] = useState(paramCaseId || "CASE-1042");
  const [cases, setCases] = useState<CaseBundle[]>([]);
  const [view, setView] = useState<WorkflowView | null>(null);
  const [actor, setActor] = useState("Legal Officer A");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (paramCaseId) {
      setCaseId(paramCaseId);
    }
  }, [paramCaseId]);

  useEffect(() => {
    api.cases().then(setCases).catch(() => {});
  }, []);

  async function refresh(id: string) {
    setView(null);
    api.workflow(id).then((data) => setView({ ...data, events: data.events })).catch((err) => setMessage({ tone: "err", text: err.message }));
  }

  useEffect(() => { refresh(caseId); }, [caseId]);

  async function act(action: string) {
    if (!actor.trim()) { setMessage({ tone: "err", text: "Enter your name/role first." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const next = await api.workflowAction(caseId, action, actor.trim(), note.trim());
      setView({ ...next, events: [] });
      setMessage({ tone: "ok", text: `${action} recorded by ${actor.trim()}.` });
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Workflow action failed" });
    } finally {
      setBusy(false);
    }
  }

  const pendingLevel = view?.levels.find((level) => level.status === "PENDING");
  const completed = view?.final_decision !== "PENDING";

  const caseIdsList = cases.length > 0 ? cases.map((b) => b.case.id) : ["CASE-1042", "CASE-2088", "CASE-3156", "CASE-4471", "CASE-5099"];
  const uniqueCaseIds = Array.from(new Set([caseId, ...caseIdsList]));

  const breadcrumbs = [
    { label: "Audit Trail" },
  ];

  return (
    <PageShell eyebrow="FOUR-EYE SAFEGUARD" title="Verification before action." breadcrumbs={breadcrumbs}>
      <section className="panel workflow-page">
        <div className="wf-toolbar">
          <label htmlFor="select-case">Case
            <select id="select-case" value={caseId} onChange={(event) => setCaseId(event.target.value)} aria-label="Select case ID">
              {uniqueCaseIds.map((id) => {
                const found = cases.find((b) => b.case.id === id);
                const labelStr = found ? `${id} · ${found.prisoner.name}` : id;
                return <option key={id} value={id}>{labelStr}</option>;
              })}
            </select>
          </label>
          <label htmlFor="actor-name">Acting as
            <input id="actor-name" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Acting officer name" />
          </label>
          <label htmlFor="review-note">Note
            <input id="review-note" value={note} placeholder="Source documents checked" onChange={(event) => setNote(event.target.value)} aria-label="Verification notes" />
          </label>
        </div>

        {message && <div className={`api-error ${message.tone === "ok" ? "ok" : ""}`}>{message.text}</div>}

        {!view && !message && <SkeletonCard />}

        {view && (
          <>
            <div className="wf-levels">
              {view.levels.map((level) => {
                const done = level.status === "APPROVED";
                const rejected = level.status === "REJECTED";
                const active = level.status === "PENDING" && !completed;
                return (
                  <div key={level.level} className={`wf-level ${done ? "done" : rejected ? "no" : active ? "active" : ""}`}>
                    <span className="wf-icon">
                      {done ? <BadgeCheck size={18} /> : rejected ? <ShieldX size={17} /> : <CircleDashed size={18} />}
                    </span>
                    <div>
                      <small>LEVEL {level.level}</small>
                      <b>{level.role}</b>
                      {level.actor ? <span>{level.actor} · {level.status}</span> : <span>Awaiting action</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="wf-actions">
              {completed ? (
                <span className={`final-decision ${view.final_decision === "APPROVED" ? "ok" : "no"}`}>
                  FINAL DECISION: {view.final_decision}
                </span>
              ) : (
                <>
                  {pendingLevel?.level === 1 && <button className="primary" disabled={busy} onClick={() => act("verify")}>Verify documents</button>}
                  {pendingLevel && pendingLevel.level > 1 && <button className="primary" disabled={busy} onClick={() => act("approve")}>Approve level {pendingLevel.level}</button>}
                  <button className="outline" disabled={busy} onClick={() => act("reject")}>Reject</button>
                  <button className="text-btn" disabled={busy} onClick={() => act("request_changes")}><RotateCcw size={14} /> Request changes</button>
                </>
              )}
            </div>

            {pendingLevel && (
              <p className="wf-hint"><LockKeyhole size={13} /> {view.next_action}. Every approval must be by an independent actor.</p>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}

export default function WorkflowPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <WorkflowContent />
    </Suspense>
  );
}
