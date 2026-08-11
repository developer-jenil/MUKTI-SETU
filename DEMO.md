# 🎬 MUKTI-SETU — 5-Minute Demo Script

Everything below runs offline. The only optional add-on is a `GROQ_API_KEY` for live LLM classification (the conservative fallback takes over automatically without it).

**Prep (before the demo):**

```powershell
# terminal 1 — backend
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# terminal 2 — frontend
cd frontend
npm run dev
```

---

| Time | Action | What the audience sees |
|---|---|---|
| **0:00** | Open `http://localhost:3000` | Landing console: GSAP reveal, pipeline nodes light up, stat counters count up from live `/api/dashboard` data |
| **0:30** | Scroll to the review queue, click **CASE-1042** | Live case viewer: eligibility signal (S.479(1) first proviso), source truth panel, **rule checklist stamps in one by one**, proof card draws its bounding boxes |
| **1:15** | Open **Audit trail** (Workflow) | Four-Eye columns (Officer → Lawyer → Judge). Click **Verify documents** as "Legal Officer A", then try **Approve** as the *same* actor → **409 "independent actor required"** — the guard is real. Approve as a new actor |
| **2:15** | Open **Intake desk** (Upload) | Drag `mock_data/court_orders/case_001_order.pdf` onto the drop zone → progress → OCR + LLM result with FIR, adjournment classification, confidence, and bounding-box draw |
| **3:00** | Open **Rule sandbox** (Simulator) | Slide the sentence years and custody days — the **custody bar tweens** toward the threshold line; results come from the real engine via `/api/simulator` |
| **3:45** | **Unplug the internet** (or just never set `GROQ_API_KEY`) | Everything keeps working — rule engine, OCR fallback, mock persistence. The law always works |
| **4:15** | Terminal 1: `python run_golden.py` | **GT-01..GT-05 all PASS** — the deterministic core is proven |
| **4:30** | Backend terminal: `http://localhost:8000/docs` | Show the API surface, then wrap up: *"Decision support — every result carries an auditable trace and requires human verification."* |

## What to emphasize
- **Neuro-symbolic separation**: AI perceives (OCR/LLM), code reasons (rule engine), humans decide (Four-Eye).
- **Fails closed**: no key, no internet, no database → the engine still answers, flagged for human review.
- **Auditability**: every decision ships its full rule trace; every workflow step is logged.
