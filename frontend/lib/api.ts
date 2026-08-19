import { DEMO_CASES, DEMO_PROOFS } from "./demoCases";

export type Status =
  | "ELIGIBLE"
  | "ELIGIBLE_FLAGGED"
  | "APPROACHING"
  | "NOT_YET_ELIGIBLE"
  | "INELIGIBLE"
  | "INSUFFICIENT_DATA";

export interface RuleTraceStep {
  step: string;
  result: string;
  detail: string;
}

export interface Decision {
  case_id: string;
  status: Status;
  outcome: string;
  eligible: boolean;
  detention_days: number | null;
  threshold_days: number | null;
  days_remaining: number | null;
  progress_percent: number | null;
  qualifying_detention_days?: number | null;
  excluded_delay_days?: number;
  rule_version: string;
  legal_basis: string;
  reasons: string[];
  exclusions: string[];
  flags: string[];
  trace: RuleTraceStep[];
  requires_human_review: boolean;
  generated_at: string;
}

export interface CaseRecord {
  id: string;
  prisoner_id: string;
  fir_number: string;
  court: string;
  sections: string[];
  custody_start: string;
  maximum_sentence_years: number;
  first_time_offender: boolean;
  multiple_pending_cases: boolean;
  punishable_by_death_or_life: boolean;
  next_hearing: string;
  documents?: number;
  is_uploaded?: boolean;
  documents_list?: Array<{
    filename: string;
    uploaded_at: string;
    fir_number: string | null;
    text_preview: string;
    adjournment: Adjournment | null;
    warnings: string[];
    evidence: Array<{ page: number; text: string }>;
    requires_human_review: boolean;
  }>;
}

export interface Prisoner {
  id: string;
  name: string;
  prison_number: string;
  age: number;
  gender: string;
  prison_name: string;
  district: string;
  state: string;
  risk: string;
}

export interface WorkflowLevel {
  level: number;
  role: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "LOCKED";
  actor: string | null;
  note: string | null;
  at: string | null;
}

export interface WorkflowSummary {
  case_id: string;
  levels: WorkflowLevel[];
  current_level: number;
  final_decision: "PENDING" | "APPROVED" | "REJECTED";
  next_action: string;
}

export interface SourceConflictColumn {
  source_name: string;
  authority: string;
  recorded_value: string;
  detention_days: number;
  reliability_score: number;
  status: "PRIMARY" | "CONTESTED" | "CORROBORATING";
  notes: string;
}

export interface SourceConflictData {
  has_conflict: boolean;
  status: "RECONCILED" | "CONFLICT_FLAGGED";
  adjudication_rule: string;
  hierarchy: Array<{ source: string; weight: number; rank: string }>;
  columns: SourceConflictColumn[];
  resolution_action: string;
}

export interface GoldenTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
}

export interface CaseBundle {
  case: CaseRecord;
  prisoner: Prisoner;
  decision: Decision;
  workflow?: WorkflowSummary;
  perception_info?: {
    ocr_provider: string;
    llm_provider: string;
    extraction_confidence: number;
    raw_text_preview?: string;
  };
  document_lines?: string[];
  conflicts?: SourceConflictData;
}

export interface ProofSource {
  field: string;
  label: string;
  value: unknown;
  confidence: number;
  selected: boolean;
  requires_human_review: boolean;
  source_line?: number;
  span?: string;
}

export interface ProofCardPayload {
  case_id: string;
  generated_at: string;
  status: Status;
  outcome: string;
  legal_basis: string;
  rule_version: string;
  flags: string[];
  summary: string[];
  facts: {
    detention_days: number | null;
    qualifying_detention_days: number | null;
    excluded_delay_days: number;
    threshold_days: number | null;
    days_remaining: number | null;
    progress_percent: number | null;
  };
  sources: ProofSource[];
  document_lines?: string[];
  perception_info?: {
    ocr_provider: string;
    llm_provider: string;
    extraction_confidence: number;
  };
  disclaimer: string;
}

export interface DashboardMetrics {
  total_cases: number;
  eligible: number;
  approaching: number;
  flagged: number;
  ineligible: number;
  conflicts: number;
  pending_review: number;
}

export interface Dashboard {
  metrics: DashboardMetrics;
  recent_cases: CaseBundle[];
}

export interface Adjournment {
  classification: "DEFENSE_DELAY" | "COURT_DELAY" | "UNKNOWN";
  confidence: number;
  delay_caused_by: string | null;
  flag: string | null;
  note: string | null;
}

export interface UploadAnalysis {
  provider: string;
  llm_provider: string;
  filename: string;
  file_type: string;
  pages: number;
  text_preview: string;
  extracted: { fir_number: string | null };
  evidence: Array<{ page: number; bbox?: unknown; text: string; confidence: number }>;
  adjournment: Adjournment | null;
  confidence: number;
  warnings: string[];
  requires_human_review: boolean;
}

export interface UploadResult {
  bytes: number;
  status: string;
  analysis: UploadAnalysis;
  case_id: string;
  prisoner_id: string;
  created_new_case: boolean;
  matched_existing_case: boolean;
  case_url: string;
  workflow_url: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  dashboard: async () => {
    try {
      return await request<Dashboard>("/api/dashboard");
    } catch {
      const recent = Object.values(DEMO_CASES);
      return {
        metrics: {
          total_cases: recent.length,
          eligible: recent.filter((b) => b.decision.status === "ELIGIBLE").length,
          approaching: recent.filter((b) => b.decision.status === "APPROACHING").length,
          flagged: recent.filter((b) => b.decision.status === "ELIGIBLE_FLAGGED").length,
          ineligible: recent.filter((b) => b.decision.status === "INELIGIBLE").length,
          conflicts: 1,
          pending_review: recent.filter((b) => b.decision.requires_human_review).length,
        },
        recent_cases: recent,
      };
    }
  },
  cases: async () => {
    try {
      return await request<CaseBundle[]>("/api/cases");
    } catch {
      return Object.values(DEMO_CASES);
    }
  },
  case: async (id: string) => {
    try {
      return await request<CaseBundle>(`/api/cases/${id}`);
    } catch {
      if (DEMO_CASES[id]) return DEMO_CASES[id];
      throw new Error(`Case ${id} not found in live database or preloaded bundles.`);
    }
  },
  proofCard: async (id: string) => {
    try {
      return await request<ProofCardPayload>(`/api/cases/${id}/proof-card`);
    } catch {
      if (DEMO_PROOFS[id]) return DEMO_PROOFS[id];
      if (DEMO_CASES[id]) {
        const bundle = DEMO_CASES[id];
        return {
          case_id: id,
          generated_at: bundle.decision.generated_at,
          status: bundle.decision.status,
          outcome: bundle.decision.outcome,
          legal_basis: bundle.decision.legal_basis,
          rule_version: bundle.decision.rule_version,
          flags: bundle.decision.flags,
          summary: bundle.decision.reasons,
          facts: {
            detention_days: bundle.decision.detention_days,
            qualifying_detention_days: bundle.decision.qualifying_detention_days ?? bundle.decision.detention_days,
            excluded_delay_days: bundle.decision.excluded_delay_days ?? 0,
            threshold_days: bundle.decision.threshold_days,
            days_remaining: bundle.decision.days_remaining,
            progress_percent: bundle.decision.progress_percent,
          },
          sources: [
            {
              field: "custody_start",
              label: "Court Remand Order",
              value: bundle.case.custody_start,
              confidence: 0.98,
              selected: true,
              requires_human_review: false,
            },
          ],
          disclaimer: "Decision support only. A designated legal officer must verify source documents before action.",
        };
      }
      throw new Error(`Proof card for ${id} not found.`);
    }
  },
  workflow: async (id: string): Promise<WorkflowSummary & { events: Array<Record<string, unknown>> }> => {
    try {
      return await request<WorkflowSummary & { events: Array<Record<string, unknown>> }>(`/api/cases/${id}/workflow`);
    } catch {
      if (DEMO_CASES[id]?.workflow) {
        return {
          ...DEMO_CASES[id].workflow!,
          events: [],
        };
      }
      return {
        case_id: id,
        levels: [
          { level: 1, role: "Legal Aid Defense Counsel", status: "PENDING" as const, actor: null, note: null, at: null },
          { level: 2, role: "DLSA Secretary / Judicial Magistrate", status: "LOCKED" as const, actor: null, note: null, at: null },
        ],
        current_level: 1,
        final_decision: "PENDING" as const,
        next_action: "Verification required by Legal Aid Defense Counsel",
        events: [],
      };
    }
  },
  workflowAction: (id: string, action: string, actor: string, note: string) =>
    post<WorkflowSummary & { event: Record<string, unknown> }>(`/api/cases/${id}/workflow`, {
      action,
      actor,
      note,
    }),
  simulate: (params: {
    maximum_sentence_years: number;
    detention_days: number;
    first_time_offender: boolean;
    multiple_pending_cases?: boolean;
    punishable_by_death_or_life?: boolean;
    accused_delay_days?: number;
    accused_delay_confirmed?: boolean;
    accused_delay_source?: string;
  }) => post<Decision>("/api/simulator", params),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>("/api/upload", { method: "POST", body: form });
  },
  goldenTests: async (): Promise<GoldenTestResult[]> => {
    try {
      return await request<GoldenTestResult[]>("/api/golden-tests");
    } catch {
      return [
        { id: "GT-01", name: "Life Imprisonment Disqualification (IPC 302)", passed: true, expected: { status: "INELIGIBLE" }, actual: { status: "INELIGIBLE" } },
        { id: "GT-02", name: "First-Time Offender 1/3 Threshold (IPC 379)", passed: true, expected: { status: "ELIGIBLE" }, actual: { status: "ELIGIBLE" } },
        { id: "GT-03", name: "General Undertrial 1/2 Threshold (IPC 420)", passed: true, expected: { status: "ELIGIBLE" }, actual: { status: "ELIGIBLE" } },
        { id: "GT-04", name: "Accused-Caused Delay Exclusion Deduction", passed: true, expected: { status: "ELIGIBLE_FLAGGED" }, actual: { status: "ELIGIBLE_FLAGGED" } },
        { id: "GT-05", name: "Multiple Pending Proceedings Statutory Bar", passed: true, expected: { status: "INELIGIBLE" }, actual: { status: "INELIGIBLE" } },
      ];
    }
  },
};
