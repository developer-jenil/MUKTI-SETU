from __future__ import annotations

import logging
import json
import os
import re
import tempfile
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config.settings import settings

logger = logging.getLogger(__name__)


def _normalize_fir(fir: str | None) -> str:
    if not fir:
        return ""
    cleaned = re.sub(r"^fir\s*(?:no\.?|number|#)?\s*", "", fir.strip(), flags=re.IGNORECASE)
    return re.sub(r"[^\w]", "", cleaned).lower()


class MockRepository:
    """Small durable JSON repository for offline mode.

    It is intentionally shaped like the PostgreSQL repository so the offline
    demo also survives API restarts and preserves its audit trail.
    """

    name = "mock-file"

    def __init__(self, path: str | Path | None = None) -> None:
        self._path = Path(path or (Path(__file__).parents[2] / "data" / "mock_state.json"))
        self._state: dict[str, Any] = self._load()

    def _seed_data(self) -> dict[str, Any]:
        mock_db_path = Path(__file__).parents[2] / "data" / "mock_db.json"
        try:
            return json.loads(mock_db_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {"prisoners": [], "cases": []}

    def _load(self) -> dict[str, Any]:
        seed = self._seed_data()
        prisoners_map: dict[str, dict[str, Any]] = {p["id"]: deepcopy(p) for p in seed.get("prisoners", [])}
        cases_map: dict[str, dict[str, Any]] = {c["id"]: deepcopy(c) for c in seed.get("cases", [])}

        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            for p in payload.get("prisoners", []):
                prisoners_map[p["id"]] = deepcopy(p)
            for c in payload.get("cases", []):
                cases_map[c["id"]] = deepcopy(c)
            return {
                "prisoners": prisoners_map,
                "cases": cases_map,
                "decisions": payload.get("decisions", {}),
                "workflow_events": payload.get("workflow_events", {}),
                "truth_discovery": payload.get("truth_discovery", {}),
            }
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return {
                "prisoners": prisoners_map,
                "cases": cases_map,
                "decisions": {},
                "workflow_events": {},
                "truth_discovery": {},
            }

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        state_to_save = {
            "prisoners": list(self._state["prisoners"].values()),
            "cases": list(self._state["cases"].values()),
            "decisions": self._state["decisions"],
            "workflow_events": self._state["workflow_events"],
            "truth_discovery": self._state["truth_discovery"],
        }
        fd, temporary = tempfile.mkstemp(prefix="mock-state-", suffix=".json", dir=self._path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump(state_to_save, stream, ensure_ascii=False, indent=2)
                stream.flush()
                os.fsync(stream.fileno())
            Path(temporary).replace(self._path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    @property
    def available(self) -> bool:
        return True

    def get_prisoners(self) -> list[dict[str, Any]]:
        return deepcopy(list(self._state["prisoners"].values()))

    def get_prisoner(self, prisoner_id: str) -> dict[str, Any] | None:
        prisoner = self._state["prisoners"].get(prisoner_id)
        return deepcopy(prisoner) if prisoner else None

    def save_prisoner(self, prisoner: dict[str, Any]) -> None:
        self._state["prisoners"][prisoner["id"]] = deepcopy(prisoner)
        self._save()

    def get_cases(self) -> list[dict[str, Any]]:
        return deepcopy(list(self._state["cases"].values()))

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        case = self._state["cases"].get(case_id)
        return deepcopy(case) if case else None

    def get_case_by_fir(self, fir_number: str) -> dict[str, Any] | None:
        norm = _normalize_fir(fir_number)
        if not norm:
            return None
        for case in self._state["cases"].values():
            if _normalize_fir(case.get("fir_number")) == norm:
                return deepcopy(case)
        return None

    def save_case(self, case: dict[str, Any]) -> None:
        self._state["cases"][case["id"]] = deepcopy(case)
        self._save()

    def add_case_document(self, case_id: str, doc: dict[str, Any]) -> None:
        case = self._state["cases"].get(case_id)
        if case:
            docs = case.setdefault("documents_list", [])
            docs.append(deepcopy(doc))
            case["documents"] = len(docs)
            self._save()

    def get_decision(self, case_id: str) -> dict[str, Any] | None:
        decision = self._state["decisions"].get(case_id)
        return deepcopy(decision) if decision else None

    def save_decision(self, case_id: str, decision: dict[str, Any]) -> None:
        self._state["decisions"][case_id] = deepcopy(decision)
        self._save()

    def add_workflow_event(
        self, case_id: str, action: str, actor: str, note: str, event: dict[str, Any] | None = None,
    ) -> None:
        record = deepcopy(event) if event else {
            "action": action,
            "actor": actor,
            "actor_id": actor,
            "actor_role": None,
            "note": note,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        self._state["workflow_events"].setdefault(case_id, []).append(record)
        self._save()

    append_workflow_event = add_workflow_event

    def load_workflow_events(self, case_id: str) -> list[dict[str, Any]]:
        return deepcopy(self._state["workflow_events"].get(case_id, []))

    def log_truth_discovery(self, case_id: str, fields: list[dict[str, Any]]) -> None:
        self._state["truth_discovery"][case_id] = deepcopy(fields)
        self._save()


class PostgresRepository:
    """Best-effort PostgreSQL persistence backed by backend/schema.sql.

    Writes are wrapped so a dropped database never breaks the demo —
    the rule engine and mock store keep working (HYBRID mode).
    """

    name = "postgres"

    def __init__(self, url: str) -> None:
        import psycopg  # local import: optional dependency

        self._url = url
        self._conn = psycopg.connect(url, connect_timeout=4)
        self._conn.autocommit = True
        self._fallback_mock = MockRepository()
        schema_path = Path(__file__).parents[2] / "schema.sql"
        with self._conn.cursor() as cur:
            cur.execute(schema_path.read_text(encoding="utf-8"))
            cur.execute("SELECT 1")  # verify connectivity at startup
        self._seed_demo_records()

    def _seed_demo_records(self) -> None:
        """Seed the bundled records so workflow foreign keys work in a fresh DB."""
        data_path = Path(__file__).parents[2] / "data" / "mock_db.json"
        try:
            payload = json.loads(data_path.read_text(encoding="utf-8"))
            with self._conn.cursor() as cur:
                for prisoner in payload.get("prisoners", []):
                    cur.execute(
                        "INSERT INTO prisoners (id, prison_number, name, gender, age, prison_name, district, state) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
                        (prisoner["id"], prisoner["prison_number"], prisoner["name"], prisoner.get("gender"),
                         prisoner.get("age"), prisoner["prison_name"], prisoner["district"], prisoner["state"]),
                    )
                for case in payload.get("cases", []):
                    cur.execute(
                        "INSERT INTO cases (id, prisoner_id, fir_number, court, sections, custody_start, "
                        "maximum_sentence_years, first_time_offender, multiple_pending_cases, punishable_by_death_or_life) "
                        "VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
                        (case["id"], case["prisoner_id"], case["fir_number"], case["court"],
                         json.dumps(case.get("sections", [])), case["custody_start"], case.get("maximum_sentence_years"),
                         case.get("first_time_offender"), case.get("multiple_pending_cases"),
                         case.get("punishable_by_death_or_life")),
                    )
        except Exception as exc:  # pragma: no cover - degraded path
            logger.warning("Could not seed bundled records: %s", exc)

    @property
    def available(self) -> bool:
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT 1")
            return True
        except Exception:  # pragma: no cover - degraded path
            return False

    def _write(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        if not self.available:
            return
        try:
            with self._conn.cursor() as cur:
                cur.execute(sql, params)
        except Exception as exc:  # pragma: no cover - best-effort persistence
            logger.warning("Postgres write skipped: %s", exc)

    def get_prisoners(self) -> list[dict[str, Any]]:
        return self._fallback_mock.get_prisoners()

    def get_prisoner(self, prisoner_id: str) -> dict[str, Any] | None:
        return self._fallback_mock.get_prisoner(prisoner_id)

    def save_prisoner(self, prisoner: dict[str, Any]) -> None:
        self._fallback_mock.save_prisoner(prisoner)
        self._write(
            "INSERT INTO prisoners (id, prison_number, name, gender, age, prison_name, district, state) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET "
            "name=EXCLUDED.name, prison_number=EXCLUDED.prison_number, age=EXCLUDED.age, "
            "gender=EXCLUDED.gender, prison_name=EXCLUDED.prison_name, district=EXCLUDED.district, state=EXCLUDED.state",
            (prisoner["id"], prisoner.get("prison_number", prisoner["id"]), prisoner["name"], prisoner.get("gender"),
             prisoner.get("age"), prisoner.get("prison_name", "Not provided"), prisoner.get("district", "Not provided"),
             prisoner.get("state", "Not provided")),
        )

    def get_cases(self) -> list[dict[str, Any]]:
        return self._fallback_mock.get_cases()

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        return self._fallback_mock.get_case(case_id)

    def get_case_by_fir(self, fir_number: str) -> dict[str, Any] | None:
        return self._fallback_mock.get_case_by_fir(fir_number)

    def save_case(self, case: dict[str, Any]) -> None:
        self._fallback_mock.save_case(case)
        self._write(
            "INSERT INTO cases (id, prisoner_id, fir_number, court, sections, custody_start, "
            "maximum_sentence_years, first_time_offender, multiple_pending_cases, punishable_by_death_or_life, documents) "
            "VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s::jsonb) ON CONFLICT (id) DO UPDATE SET "
            "fir_number=EXCLUDED.fir_number, court=EXCLUDED.court, sections=EXCLUDED.sections, "
            "custody_start=EXCLUDED.custody_start, maximum_sentence_years=EXCLUDED.maximum_sentence_years, "
            "first_time_offender=EXCLUDED.first_time_offender, multiple_pending_cases=EXCLUDED.multiple_pending_cases, "
            "punishable_by_death_or_life=EXCLUDED.punishable_by_death_or_life, documents=EXCLUDED.documents, updated_at=NOW()",
            (case["id"], case["prisoner_id"], case.get("fir_number", "UNKNOWN"), case.get("court", "Sessions Court"),
             json.dumps(case.get("sections", [])), case.get("custody_start", "2024-01-01"), case.get("maximum_sentence_years"),
             case.get("first_time_offender"), case.get("multiple_pending_cases"), case.get("punishable_by_death_or_life"),
             json.dumps(case.get("documents_list", []))),
        )

    def add_case_document(self, case_id: str, doc: dict[str, Any]) -> None:
        self._fallback_mock.add_case_document(case_id, doc)

    def get_decision(self, case_id: str) -> dict[str, Any] | None:
        return self._fallback_mock.get_decision(case_id)

    def save_decision(self, case_id: str, decision: dict[str, Any]) -> None:
        self._fallback_mock.save_decision(case_id, decision)
        self._write(
            "INSERT INTO decisions (case_id, rule_version, decision) VALUES (%s, %s, %s) "
            "ON CONFLICT DO NOTHING",
            (case_id, decision.get("rule_version", ""), json.dumps(decision)),
        )

    def add_workflow_event(
        self, case_id: str, action: str, actor: str, note: str, event: dict[str, Any] | None = None,
    ) -> None:
        self._fallback_mock.add_workflow_event(case_id, action, actor, note, event=event)
        event = event or {}
        self._write(
            "INSERT INTO workflow_events (case_id, action, actor, actor_role, note, created_at, "
            "previous_event_hash, event_hash, signature) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                case_id, action, event.get("actor_id", actor), event.get("actor_role"), note,
                event.get("at", datetime.now(timezone.utc).isoformat()),
                event.get("previous_event_hash"), event.get("event_hash"), event.get("signature"),
            ),
        )

    append_workflow_event = add_workflow_event

    def load_workflow_events(self, case_id: str) -> list[dict[str, Any]]:
        events = self._fallback_mock.load_workflow_events(case_id)
        if events:
            return events
        if not self.available:
            return []
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT action, actor, actor_role, note, created_at, previous_event_hash, event_hash, signature "
                    "FROM workflow_events WHERE case_id = %s ORDER BY created_at, id",
                    (case_id,),
                )
                return [
                    {
                        "action": row[0], "actor": row[1], "actor_id": row[1], "actor_role": row[2],
                        "note": row[3], "at": row[4].isoformat() if hasattr(row[4], "isoformat") else str(row[4]),
                        "previous_event_hash": row[5], "event_hash": row[6], "signature": row[7],
                    }
                    for row in cur.fetchall()
                ]
        except Exception as exc:  # pragma: no cover - degraded path
            logger.warning("Could not load workflow events: %s", exc)
            return []

    def log_truth_discovery(self, case_id: str, fields: list[dict[str, Any]]) -> None:
        self._fallback_mock.log_truth_discovery(case_id, fields)
        self._write(
            "INSERT INTO truth_discovery_log (case_id, field_name, resolved_value, resolved_source, "
            "confidence, detail) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            (
                case_id,
                "batch",
                json.dumps([f.get("selected_value") for f in fields], default=str),
                ",".join(str(f.get("sources", [{}])[0].get("source", "")) for f in fields if f.get("sources")),
                None,
                json.dumps(fields, default=str),
            ),
        )


def get_repository() -> MockRepository | PostgresRepository:
    """Return Postgres when configured and reachable, else the mock repository.

    In CLOUD mode a missing/unreachable database is a hard error.
    """
    url = settings.db_url or settings.db_url_env
    if url:
        try:
            return PostgresRepository(url)
        except Exception as exc:
            logger.warning("Postgres unavailable (%s); falling back to mock persistence.", exc)
            if settings.is_cloud:
                raise RuntimeError(f"CLOUD mode requires a reachable DATABASE_URL: {exc}") from exc
    return MockRepository()
