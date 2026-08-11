from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.config.settings import settings

# Source-of-truth hierarchy: Court Order > Prison Register > FIR > OCR
SOURCE_PRIORITY = {"court_order": 3, "prison_register": 2, "fir": 1, "ocr": 0}


def reconcile(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve conflicting field values across CCTNS / e-Courts / e-Prisons.

    Returns one entry per field with the selected value, resolution status and a
    per-field human-review flag (conflict, or confidence below the policy
    threshold of 0.85).
    """
    min_confidence = settings.truth_discovery_min_confidence
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record["field"]].append(record)

    output: list[dict[str, Any]] = []
    for field, sources in grouped.items():
        values = {str(source.get("value")) for source in sources}
        selected = max(
            sources,
            key=lambda source: (SOURCE_PRIORITY.get(source.get("source"), -1), source.get("confidence", 0)),
        )
        status = (
            "verified"
            if len(values) == 1 and len(sources) > 1
            else "conflict"
            if len(values) > 1
            else "single_source"
        )
        selected_confidence = float(selected.get("confidence", 0.0))
        requires_review = status == "conflict" or selected_confidence < min_confidence
        output.append({
            "field": field,
            "selected_value": selected.get("value"),
            "status": status,
            "sources": sources,
            "rationale": f"Selected {selected['source']} using source-authority priority; verify before approval.",
            "requires_human_review": requires_review,
            "selected_confidence": round(selected_confidence, 2),
        })
    return output
