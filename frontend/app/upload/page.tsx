"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";
import gsap from "gsap";
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
  const docRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!result || !docRef.current) return;
    const boxes = docRef.current.querySelectorAll(".bounding");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      boxes.forEach((b) => ((b as SVGElement).style.strokeDashoffset = "0"));
      return;
    }
    gsap.fromTo(
      boxes,
      { strokeDashoffset: 260 },
      { strokeDashoffset: 0, stagger: 0.3, duration: 0.8, ease: "power2.inOut" }
    );
  }, [result]);

  const breadcrumbs = [
    { label: "Intake Desk" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Layer 1 — the gavel image, must be visible */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/gavel-bg.jpg')",
          opacity: 0.18,
          filter: "grayscale(30%) brightness(0.9)",
        }}
      />

      {/* Layer 2 — light readability overlay, must NOT hide the image */}
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
              <div className="intake-result results">
                <div className="result-head">
                  <FileCheck2 />
                  <b>Analysis complete for {fileName}</b>
                  <span className={`pill ${result.requires_human_review ? "warn" : "ok"}`}>
                    {result.requires_human_review ? "HUMAN REVIEW REQUIRED" : "PROVISIONAL OK"}
                  </span>
                </div>

                <div className="result-grid">
                  <div>
                    <small>OCR provider</small>
                    <b>{result.provider}</b>
                  </div>
                  <div>
                    <small>LLM provider</small>
                    <b>{result.llm_provider}</b>
                  </div>
                  <div>
                    <small>FIR number</small>
                    <b>{result.extracted.fir_number ?? "—"}</b>
                  </div>
                  <div>
                    <small>Extraction confidence</small>
                    <b>{Math.round(result.confidence * 100)}%</b>
                  </div>
                  <div>
                    <small>Document pages</small>
                    <b>{result.pages}</b>
                  </div>
                  <div>
                    <small>Evidence anchors</small>
                    <b>{result.evidence.length}</b>
                  </div>
                </div>

                {result.adjournment && (
                  <div className="adjournment">
                    <small>ADJOURNMENT CLASSIFICATION</small>
                    <strong>{result.adjournment.classification.replace(/_/g, " ")}</strong>
                    <span>confidence {Math.round(result.adjournment.confidence * 100)}%</span>
                    {result.adjournment.flag && <span className="pill warn">{result.adjournment.flag}</span>}
                    {result.adjournment.note && <em>{result.adjournment.note}</em>}
                  </div>
                )}

                <div className="proof-doc" ref={docRef}>
                  <svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">
                    <rect className="bounding" x="6" y="6" width="308" height="40" />
                    <rect className="bounding second" x="6" y="56" width="190" height="30" />
                    <rect className="bounding third" x="6" y="96" width="250" height="44" />
                  </svg>
                  <div className="doc-lines">
                    <span>EXTRACTED TEXT PREVIEW · {fileName}</span>
                    <span>{result.text_preview || "No machine-readable text found."}</span>
                  </div>
                </div>

                {result.warnings.map((warning) => (
                  <p className="warning-line" key={warning}>
                    <AlertTriangle size={13} /> {warning}
                  </p>
                ))}

                {uploadData && (
                  <div className="decision-foot mt-3" style={{ gap: "14px", marginTop: "20px" }}>
                    <Link className="primary" href={`/cases/${uploadData.case_id}`}>
                      Open case ({uploadData.case_id}) <ArrowUpRight size={15} />
                    </Link>
                    <Link className="outline" href={`/workflow?case_id=${uploadData.case_id}`}>
                      Start human review <ShieldCheck size={15} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>
        </PageShell>
      </div>
    </div>
  );
}
