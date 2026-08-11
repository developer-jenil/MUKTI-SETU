from __future__ import annotations

import re
from datetime import datetime
from typing import Any


def _parse_bool(value: str | None) -> bool | None:
    if not value:
        return None
    val = value.strip().lower()
    if val in {"yes", "true", "1"}:
        return True
    if val in {"no", "false", "0"}:
        return False
    return None


def _parse_date(date_str: str | None) -> str | None:
    if not date_str:
        return None
    date_str = date_str.strip()
    # YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str
    # DD Month YYYY (e.g. 15 January 2024)
    try:
        dt = datetime.strptime(date_str, "%d %B %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    try:
        dt = datetime.strptime(date_str, "%d %b %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    return None


def extract_intake_facts(text: str) -> dict[str, Any]:
    """Extract structured labelled facts and legal parameters from document text."""
    facts: dict[str, Any] = {}

    # FIR Number
    fir_match = re.search(r"FIR\s*(?:No\.?|number|#)?[:\s]*([\w/-]+)", text, re.IGNORECASE)
    if fir_match:
        facts["fir_number"] = fir_match.group(1).strip()

    # Case ID
    case_id_match = re.search(r"(?:Case\s*ID|Case\s*No\.?)[:\s]+(CASE-[\w-]+)", text, re.IGNORECASE)
    if case_id_match:
        facts["case_id"] = case_id_match.group(1).strip()

    # Prisoner Name
    name_match = re.search(r"(?:Prisoner\s*Name|Accused\s*Name)[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if not name_match:
        name_match = re.search(r"^Name[:\s]+([^\n\r]+)", text, re.IGNORECASE | re.MULTILINE)
    if name_match:
        facts["prisoner_name"] = name_match.group(1).strip()

    # Prisoner / Prison Number
    pris_num_match = re.search(
        r"(?:Prisoner\s*(?:Number|ID)|Prison\s*(?:Number|ID))[:\s]+([^\n\r]+)", text, re.IGNORECASE
    )
    if pris_num_match:
        facts["prisoner_number"] = pris_num_match.group(1).strip()

    # Age
    age_match = re.search(r"\bAge[:\s]+(\d+)", text, re.IGNORECASE)
    if age_match:
        try:
            facts["age"] = int(age_match.group(1))
        except ValueError:
            pass

    # Gender
    gender_match = re.search(r"\bGender[:\s]+(Male|Female|Other)", text, re.IGNORECASE)
    if gender_match:
        facts["gender"] = gender_match.group(1).capitalize()

    # Prison Name
    prison_match = re.search(r"(?:Prison\s*Name|Prison)[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if prison_match:
        facts["prison_name"] = prison_match.group(1).strip()

    # District
    district_match = re.search(r"\bDistrict[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if district_match:
        facts["district"] = district_match.group(1).strip()

    # State
    state_match = re.search(r"\bState[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if state_match:
        facts["state"] = state_match.group(1).strip()

    # Sections
    sections_match = re.search(r"Sections?[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if sections_match:
        raw_sec = sections_match.group(1).strip()
        parts = [p.strip() for p in re.split(r"[,;]", raw_sec) if p.strip()]
        facts["sections"] = parts
    else:
        ipc_match = re.search(r"Sections?\s+([\d\s,and]+)\s+of\s+the\s+Indian\s+Penal\s+Code", text, re.IGNORECASE)
        if ipc_match:
            nums = re.findall(r"\d+", ipc_match.group(1))
            facts["sections"] = [f"IPC {n}" for n in nums]

    # Custody Start
    custody_match = re.search(r"(?:Custody\s*Start|Date\s*of\s*Custody)[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if custody_match:
        facts["custody_start"] = _parse_date(custody_match.group(1))
    else:
        narrative_custody = re.search(r"judicial\s+custody\s+since\s+([\d]+\s+[A-Za-z]+\s+[\d]{4})", text, re.IGNORECASE)
        if narrative_custody:
            facts["custody_start"] = _parse_date(narrative_custody.group(1))

    # Maximum Sentence Years
    max_sent_match = re.search(r"Maximum\s*Sentence\s*Years?[:\s]+(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if max_sent_match:
        try:
            val = float(max_sent_match.group(1))
            facts["maximum_sentence_years"] = int(val) if val.is_integer() else val
        except ValueError:
            pass

    # First-time Offender
    first_time_match = re.search(r"First-time\s*Offender[:\s]+(Yes|No|True|False)", text, re.IGNORECASE)
    if first_time_match:
        facts["first_time_offender"] = _parse_bool(first_time_match.group(1))

    # Multiple Pending Cases
    multi_pending_match = re.search(r"Multiple\s*Pending\s*Cases?[:\s]+(Yes|No|True|False)", text, re.IGNORECASE)
    if multi_pending_match:
        facts["multiple_pending_cases"] = _parse_bool(multi_pending_match.group(1))

    # Punishable by Death or Life
    death_life_match = re.search(
        r"Punishable\s+by\s+Death\s+or\s+Life(?:\s+Imprisonment)?[:\s]+(Yes|No|True|False)", text, re.IGNORECASE
    )
    if death_life_match:
        facts["punishable_by_death_or_life"] = _parse_bool(death_life_match.group(1))

    # Next Hearing
    next_hearing_match = re.search(r"Next\s*Hearing[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if next_hearing_match:
        facts["next_hearing"] = next_hearing_match.group(1).strip()

    # Case Status
    status_match = re.search(r"Case\s*Status[:\s]+([^\n\r]+)", text, re.IGNORECASE)
    if status_match:
        facts["case_status"] = status_match.group(1).strip()

    return facts
