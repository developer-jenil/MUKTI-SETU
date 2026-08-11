"use client";

import type { Status } from "../../lib/api";

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  ELIGIBLE: { label: "Eligible", tone: "mint" },
  ELIGIBLE_FLAGGED: { label: "Flagged", tone: "violet" },
  APPROACHING: { label: "Monitoring", tone: "amber" },
  NOT_YET_ELIGIBLE: { label: "Below threshold", tone: "gray" },
  INELIGIBLE: { label: "Ineligible", tone: "red" },
  INSUFFICIENT_DATA: { label: "Review needed", tone: "red" },
};

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "gray" };
  return (
    <span className={`status ${meta.tone}`} role="status" aria-label={`Status: ${meta.label}`}>
      {meta.label}
    </span>
  );
}
