# MUKTI-SETU

**Statutory Compliance Orchestration Platform** — an offline-first, neuro-symbolic legal-aid intelligence prototype that identifies undertrial cases eligible for statutory bail review under **Section 479 BNSS** (Bharatiya Nagarik Suraksha Sanhita). Problem Statement **SIH1282**, Ministry of Law & Justice.

MUKTI-SETU is **decision support, not an automated release system**: every result carries an auditable trace and requires human verification through a Four-Eye Review.

## 🧠 The design: Neuro-Symbolic

| Layer | Role | Tech |
|---|---|---|
| **Perception (AI)** | Reads messy court PDFs, classifies adjournment causes | EasyOCR (optional) + Groq LLM (`llama3-70b-8192`) with a conservative offline fallback |
| **Reasoning (Code)** | Computes eligibility — **the LLM never calculates eligibility** | Deterministic Python rule engine + versioned YAML policy |
| **Human authority** | Four-Eye Review: Legal Officer → Lawyer → Judge | `services/workflow/four_eye.py` |

**The law always works.** If OCR, the LLM, or even the database fail, the rule engine keeps running from the mock persistence layer.

## ⚖️ Rule engine (Section 479 BNSS)

Evaluated in priority order — every step is traced:

1. **Opening exclusion** → `INELIGIBLE` — offences punishable with death/life imprisonment (`S.479(1)`)
2. **Maximum-period proviso** → `ELIGIBLE_FLAGGED` — qualifying custody cannot exceed the maximum sentence period
3. **Multiple proceedings** → `INELIGIBLE` below that maximum (`S.479(2)`, subject to the maximum-period proviso)
4. **Thresholds** → `ELIGIBLE` — first-time offender one-third (first proviso), all others one-half (`S.479(1)`)
5. **Accused-caused delay** is excluded only after a designated reviewer confirms source evidence; otherwise the result fails closed to human review.
6. Plus `APPROACHING` (≥80% of threshold) and `INSUFFICIENT_DATA` (fails closed to human review)

Policy lives in `backend/app/core/rules/section_479.yaml` (versioned: `2023-demo-v1`).

## 🏗️ Architecture

```
sih-hackathon-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app (upload, analyze, dashboard, workflow, simulator, golden-tests)
│   │   ├── config/settings.yaml    # mode: CLOUD | LOCAL | HYBRID (env-overridable)
│   │   ├── core/rule_engine.py     # deterministic Section 479 evaluator
│   │   ├── core/rules/section_479.yaml
│   │   ├── services/
│   │   │   ├── perception.py       # OCR (mock/easyocr) + FIR extraction, fails closed
│   │   │   ├── reconciliation.py   # Truth Discovery: court order > prison register > FIR > OCR
│   │   │   ├── llm/                # base + groq_provider + fallback (conservative)
│   │   │   └── workflow/four_eye.py# Officer → Lawyer → Judge, no skipping, independent actors
│   │   ├── db/repository.py        # Postgres via schema.sql with automatic mock fallback
│   │   └── store.py                # mock persistence (data/mock_db.json)
│   ├── data/                       # mock_db.json + source_conflicts.json
│   ├── tests/                      # golden fixtures + pytest suites
│   ├── schema.sql                  # PostgreSQL migration path
│   └── run_golden.py
├── frontend/                       # Next.js 14 + GSAP console
│   └── app/                        # /, /cases/[id], /upload, /simulator, /workflow
├── mock_data/                      # CCTNS / e-Courts / e-Prisons entries + sample court-order PDFs
├── scripts/generate_sample_pdfs.py
├── docker-compose.yml
└── .env.example
```

## 🚀 Run locally

**Backend** (terminal 1):

```powershell
cd C:\sih-hackathon-prototype\backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend** (terminal 2):

```powershell
cd C:\sih-hackathon-prototype\frontend
npm install
npm run dev
```

- Console: `http://localhost:3000` · API docs: `http://localhost:8000/docs`
- The frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).

## 🌐 Modes (`backend/app/config/settings.yaml` + env)

| Mode | Behaviour |
|---|---|
| `LOCAL` | Mock persistence + conservative fallbacks only. Fully offline. |
| `HYBRID` *(default)* | Uses Postgres/Groq when available, degrades gracefully. |
| `CLOUD` | Requires a reachable `DATABASE_URL` (raises if unavailable). |

Environment overrides: `MODE`, `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `OCR_PROVIDER`, `LLM_PROVIDER`, `LLM_MIN_CONFIDENCE`, `AUTH_REQUIRED`, `AUTH_TOKEN_SECRET`, `AUDIT_SIGNING_SECRET`, `CORS_ORIGINS`.

In `CLOUD` mode, signed bearer identity tokens are required. Tokens bind a server-side user ID to one of `LEGAL_OFFICER`, `LAWYER`, or `JUDGE`; workflow events are hash-chained and HMAC-signed. Local/HYBRID mode keeps the demo walkthrough available without an identity provider, but production deployments should set `AUTH_REQUIRED=true`.

### LLM & OCR
- Set `GROQ_API_KEY` to enable `llama3-70b-8192` adjournment classification. Without a key, the **conservative fallback** returns `COURT_DELAY` @ 0.50 confidence with a mandatory `HUMAN_REVIEW_REQUIRED` flag — no time is ever deducted from custody because the AI could not verify.
- Text PDFs are parsed with `pypdf`; image/scanned PDFs can use page-level EasyOCR with evidence bounding boxes. Real OCR is optional (heavy): `pip install -r requirements-ocr.txt`, then set `OCR_PROVIDER=easyocr`.
- Uploads are capped at 20 MB and checked against their declared file signatures. Configure `CLAMAV_SOCKET` in `CLOUD` mode to enable malware scanning; cloud uploads fail closed if the scanner is unavailable.

### PostgreSQL
Set `DATABASE_URL` and the app auto-applies `schema.sql` (`prisoners`, `cases`, `decisions`, `workflow_events`, `review_workflow`, `truth_discovery_log`) and seeds the bundled demo records. Without it, the demo uses durable file-backed state at `backend/data/mock_state.json`.

## ✅ Validation

```powershell
cd backend
.\.venv\Scripts\python.exe run_golden.py     # GT-01..GT-05 must all print PASS
.\.venv\Scripts\python.exe -m pytest -q      # golden + rule engine + API + services + workflow suites
.\.venv\Scripts\python.exe -m compileall app # syntax check
```

```powershell
cd frontend
npm run build                                # Next.js production build + type check
```

Golden tests GT-01–GT-05 run in isolation (no OCR, no LLM, no DB):

| Test | Scenario | Expected |
|---|---|---|
| GT-01 | Life imprisonment, 6 yr custody | `INELIGIBLE` · S.479(1) Proviso |
| GT-02 | 3 yr max, 3 yr + 1 day custody | `ELIGIBLE_FLAGGED` · S.479(1) third proviso |
| GT-03 | Multiple pending cases | `INELIGIBLE` · S.479(2) |
| GT-04 | First-time offender, ⅓ threshold | `ELIGIBLE` · S.479(1) first proviso |
| GT-05 | Other undertrial, ½ threshold | `ELIGIBLE` · S.479(1) |

## 🔌 API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Mode, persistence, rule version |
| GET | `/api/golden-tests` | Run golden suite |
| GET | `/api/dashboard` | Metrics + recent case bundles |
| GET | `/api/cases/{id}` | Case bundle + decision + workflow |
| POST | `/api/analyze` | Run the rule engine on facts |
| POST | `/api/upload` | PDF/text → OCR + LLM classification |
| POST | `/api/reconcile` | Truth Discovery across sources |
| GET | `/api/cases/{id}/proof-card` | Auditable evidence card |
| GET/POST | `/api/cases/{id}/workflow` | Four-Eye actions (`verify`/`approve`/`reject`/…) |
| POST | `/api/workflow/approve\|reject/{level}` | Spec-level workflow endpoints |
| POST | `/api/simulator` | What-if threshold projection |

## 🎬 Demo

Follow the 5-minute walkthrough in [`DEMO.md`](DEMO.md).

## 🐳 Docker

```bash
cp .env.example .env   # set GROQ_API_KEY if desired
docker compose up --build            # api + web (+ mock persistence)
docker compose --profile postgres up # also start Postgres; set DATABASE_URL
```

## 🚨 Critical rules

1. Eligibility is **100% deterministic Python**. No AI in the calculation.
2. The LLM classifies adjournments only — and has a conservative fallback.
3. If Groq fails, the system still works.
4. Four-Eye levels cannot be skipped; every approval needs an independent actor.
5. Golden suite must pass 5/5 before any feature is considered complete.
6. Env vars only — API keys are never hardcoded.
