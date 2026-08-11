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

export interface CaseBundle {
  case: CaseRecord;
  prisoner: Prisoner;
  decision: Decision;
  workflow?: WorkflowSummary;
}

export interface ProofSource {
  field: string;
  label: string;
  value: unknown;
  confidence: number;
  selected: boolean;
  requires_human_review: boolean;
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
  dashboard: () => request<Dashboard>("/api/dashboard"),
  cases: () => request<CaseBundle[]>("/api/cases"),
  case: (id: string) => request<CaseBundle>(`/api/cases/${id}`),
  proofCard: (id: string) => request<ProofCardPayload>(`/api/cases/${id}/proof-card`),
  workflow: (id: string) =>
    request<WorkflowSummary & { events: Array<Record<string, unknown>> }>(`/api/cases/${id}/workflow`),
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
};
