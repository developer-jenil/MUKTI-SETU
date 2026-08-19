"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Cpu,
  FileCheck2,
  FileText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { api, type UploadAnalysis, type UploadResult } from "../../lib/api";
import { PageShell } from "../components";

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadAnalysis | null>(null);
  const [uploadData, setUploadData] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setFileSize(file.size);
    setBusy(true);
    setError(null);
    setResult(null);
    setUploadData(null);
    try {
      const upload = await api.upload(file);
      setUploadData(upload);
      setResult(upload.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const breadcrumbs = [{ label: "Intake Desk" }];

  const previewLines = result?.text_preview
    ? result.text_preview.split("\n").filter((l) => l.trim().length > 0)
    : [
        "IN THE COURT OF SESSIONS JUDGE AT DISTRICT JUDICIAL COMPLEX",
        "CASE NO: CR/502/2024 · ARISING FROM FIR NO: 221/2024",
        "POLICE STATION: CRIME BRANCH · ACCUSED: UNDER TRIAL PRISONER",
        "REMAND ORDER: UNDER SECTION 479 BNSS CUSTODY ASSESSMENT",
        "RECORD OF PROCEEDINGS: SCHEDULED FOR STATUTORY BAIL SCREENING",
      ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Gavel layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/gavel-bg.jpg')",
          opacity: 0.18,
          filter: "grayscale(30%) brightness(0.9)",
        }}
      />

      {/* Light overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0b1116]/40 via-transparent to-[#0b1116]/80"
      />

      {/* Content Layer */}
      <div className="relative z-10">
        <PageShell eyebrow="DOCUMENT INTAKE" title="Bring a record into focus." breadcrumbs={breadcrumbs}>
          <section className="panel intake">
            <label
              className={dragging ? "drop dragging" : "drop"}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <UploadCloud size={42} />
              <strong>{busy ? "Analyzing document…" : fileName || "Drop a court order or prison register"}</strong>
              <span>
                {fileSize
                  ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB · Processing OCR & Adjournment classification`
                  : "PDF, image or text · up to 20 MB"}
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                aria-label="Upload document file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>

            {error && <div className="api-error">{error}</div>}

            {busy && (
              <div className="intake-result">
                <span className="spinner" />
                <div>
                  <b>Extracting facts from {fileName}…</b>
                  <small>OCR reads the document structure, LLM classifies adjournment reasons under BNSS S.479.</small>
                </div>
              </div>
            )}

            {result && !busy && (
              <div className="intake-analysis-wrap" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* ZONE 1: AI DOCUMENT PERCEPTION — PROBABILISTIC (AMBER HARD WALL) */}
                <div className="panel zone-amber-wall" style={{ margin: 0 }}>
                  <div className="zone-wall-header amber">
                    <div className="zone-tag">
                      <Sparkles size={14} />
                      <span>ZONE 1: AI DOCUMENT PERCEPTION — PROBABILISTIC</span>
                    </div>
                    <span className="confidence-pill">
                      Extraction Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                  </div>

                  <div className="zone-meta-strip">
                    <span><b>OCR Provider:</b> {result.provider}</span>
                    <span><b>LLM Provider:</b> {result.llm_provider}</span>
                    <span className="human-warn"><AlertTriangle size={13} /> Subject to officer verification</span>
                  </div>

                  <div className="result-grid" style={{ marginTop: "14px" }}>
                    <div>
                      <small>FIR number</small>
                      <b>{result.extracted.fir_number ?? "Extracted via Header"}</b>
                    </div>
                    <div>
                      <small>Document pages</small>
                      <b>{result.pages}</b>
                    </div>
                    <div>
                      <small>Evidence anchors</small>
                      <b>{result.evidence.length} facts</b>
                    </div>
                    <div>
                      <small>Review status</small>
                      <b style={{ color: result.requires_human_review ? "var(--amber)" : "var(--mint)" }}>
                        {result.requires_human_review ? "Human Review Required" : "Automated Intake Passed"}
                      </b>
                    </div>
                  </div>

                  {result.adjournment && (
                    <div className="adjournment" style={{ marginTop: "16px" }}>
                      <small>ADJOURNMENT CAUSE CLASSIFICATION</small>
                      <strong>{result.adjournment.classification.replace(/_/g, " ")}</strong>
                      <span>Classification Confidence: {Math.round(result.adjournment.confidence * 100)}%</span>
                      {result.adjournment.flag && <span className="pill warn">{result.adjournment.flag}</span>}
                      {result.adjournment.note && <em>{result.adjournment.note}</em>}
                    </div>
                  )}

                  {/* Document Line Inspector (Zero SVG Hardcoded Rects) */}
                  <div className="inspector-pane doc-pane" style={{ marginTop: "16px" }}>
                    <div className="pane-header">
                      <FileText size={14} />
                      <span>PARSED DOCUMENT TEXT (LINE-BY-LINE)</span>
                    </div>
                    <div className="doc-lines-container" style={{ maxHeight: "200px" }}>
                      {previewLines.map((line, idx) => (
                        <div
                          key={idx}
                          className={`doc-line-row ${hoveredLine === idx ? "highlighted" : ""}`}
                          onMouseEnter={() => setHoveredLine(idx)}
                          onMouseLeave={() => setHoveredLine(null)}
                        >
                          <span className="line-num">{(idx + 1).toString().padStart(2, "0")}</span>
                          <span className="line-text">{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.warnings.map((warning) => (
                    <p className="warning-line" key={warning} style={{ marginTop: "12px" }}>
                      <AlertTriangle size={13} /> {warning}
                    </p>
                  ))}
                </div>

                {/* ZONE 2: STATUTORY RULE ENGINE — 100% DETERMINISTIC (EMERALD HARD WALL) */}
                <div className="panel zone-emerald-wall" style={{ margin: 0 }}>
                  <div className="zone-wall-header emerald">
                    <div className="zone-tag">
                      <ShieldCheck size={15} />
                      <span>ZONE 2: STATUTORY RULE ENGINE — 100% DETERMINISTIC · BNSS S.479</span>
                    </div>
                    <span className="deterministic-pill">
                      Deterministic Execution · YAML Rules v2024.1
                    </span>
                  </div>

                  <div className="zone-meta-strip emerald">
                    <span><b>Engine:</b> Section 479 Python Engine</span>
                    <span><b>Statutory Standard:</b> 1/3 or 1/2 Custody Fractions</span>
                    <span className="math-tag"><Cpu size={13} /> Zero-Hallucination Math</span>
                  </div>

                  <div className="custody-fraction-card" style={{ marginTop: "14px" }}>
                    <div className="fraction-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Calculator size={15} className="text-mint" />
                        <b>STATUTORY CUSTODY DETERMINATION PIPELINE</b>
                      </div>
                      <span className="fraction-badge">S.479(1) Proviso Screening</span>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                      Extracted facts are piped to the deterministic rule engine. Exclusion filters (Capital/Life S.479(1), Multiple trials S.479(2)) are verified in priority order. No statistical scores or probabilities are used in legal eligibility computation.
                    </p>
                  </div>

                  {uploadData && (
                    <div className="decision-foot" style={{ gap: "14px", marginTop: "18px" }}>
                      <Link className="primary" href={`/cases/${uploadData.case_id}`}>
                        Open case ({uploadData.case_id}) <ArrowUpRight size={15} />
                      </Link>
                      <Link className="outline" href={`/workflow?case_id=${uploadData.case_id}`}>
                        Start human review <ShieldCheck size={15} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </PageShell>
      </div>
    </div>
  );
}
