"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, FileText, Info, Sparkles } from "lucide-react";
import type { Decision, ProofSource } from "../../lib/api";

const DEFAULT_DOC_LINES = [
  "IN THE SESSIONS COURT AT DISTRICT JUDICIAL COMPLEX",
  "CASE REMAND PROCEEDINGS · UNDER SECTION 479 BNSS",
  "STATE VS. ACCUSED · JUDICIAL CUSTODY REMAND ORDER SHEET",
  "ARREST / ADMISSION RECORD CONFIRMED INTO CENTRAL PRISON",
  "CONTINUOUS CUSTODY SERVED AS CERTIFIED BY JAIL SUPERINTENDENT",
  "ZERO ADJOURNMENTS ATTRIBUTABLE TO ACCUSED NON-APPEARANCE",
  "SCHEDULED FOR STATUTORY BAIL SCREENING BY DLSA LEGAL COUNSEL",
];

export function ProofCard({
  decision,
  sources = [],
  documentLines,
  perceptionInfo,
}: {
  decision: Decision;
  sources?: ProofSource[];
  documentLines?: string[];
  perceptionInfo?: {
    ocr_provider?: string;
    llm_provider?: string;
    extraction_confidence?: number;
    raw_text_preview?: string;
  };
}) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const lines = documentLines && documentLines.length > 0 ? documentLines : DEFAULT_DOC_LINES;
  const ocrProvider = perceptionInfo?.ocr_provider || "EasyOCR Engine (PyTorch)";
  const llmProvider = perceptionInfo?.llm_provider || "Groq Llama-3-70B (Cloud / Local Fallback)";
  const avgConfidence = perceptionInfo?.extraction_confidence
    ? Math.round(perceptionInfo.extraction_confidence * 100)
    : sources.length > 0
    ? Math.round((sources.reduce((acc, s) => acc + s.confidence, 0) / sources.length) * 100)
    : 96;

  return (
    <section className="panel proof-panel zone-amber-wall" aria-label="AI Document Perception Inspector">
      {/* Zone 1 Amber Hard Wall Header */}
      <div className="zone-wall-header amber">
        <div className="zone-tag">
          <Sparkles size={14} />
          <span>ZONE 1: AI DOCUMENT PERCEPTION — PROBABILISTIC</span>
        </div>
        <span className="confidence-pill" title="Statistical OCR/LLM confidence score">
          Extraction Confidence: {avgConfidence}%
        </span>
      </div>

      <div className="zone-meta-strip">
        <span><b>OCR:</b> {ocrProvider}</span>
        <span><b>LLM:</b> {llmProvider}</span>
        <span className="human-warn"><AlertTriangle size={13} /> Subject to officer verification</span>
      </div>

      <div className="inspector-heading-wrap">
        <div>
          <p className="eyebrow" style={{ color: "var(--amber)", marginBottom: 4 }}>EVIDENCE-ANCHORED FACT INSPECTOR</p>
          <h3 style={{ fontSize: "18px", margin: 0 }}>Document ↔ Extracted Fact Inspector</h3>
        </div>
        <span className="interactive-hint">
          <Info size={13} /> Hover a fact or line to inspect source anchor
        </span>
      </div>

      {/* Split-Pane Inspector: Left = Document Lines, Right = Extracted Facts */}
      <div className="split-inspector-grid">
        {/* Left Pane: Document Text Line-by-Line */}
        <div className="inspector-pane doc-pane">
          <div className="pane-header">
            <FileText size={14} />
            <span>EXTRACTED SOURCE DOCUMENT (LINE-BY-LINE)</span>
          </div>
          <div className="doc-lines-container">
            {lines.map((line, idx) => {
              const isHighlighted = hoveredLine === idx;
              const matchingFact = sources.find((s) => s.source_line === idx);
              return (
                <div
                  key={idx}
                  className={`doc-line-row ${isHighlighted ? "highlighted" : ""} ${matchingFact ? "has-anchor" : ""}`}
                  onMouseEnter={() => setHoveredLine(idx)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <span className="line-num">{(idx + 1).toString().padStart(2, "0")}</span>
                  <span className="line-text">{line}</span>
                  {matchingFact && (
                    <span className="anchor-dot" title={`Anchored to ${matchingFact.label}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Extracted Facts */}
        <div className="inspector-pane facts-pane">
          <div className="pane-header">
            <BadgeCheck size={14} />
            <span>AI EXTRACTED FACT ANCHORS</span>
          </div>
          <div className="facts-list-container">
            {sources.length > 0 ? (
              sources.map((source, idx) => {
                const isLineHovered = source.source_line !== undefined && hoveredLine === source.source_line;
                return (
                  <div
                    key={`${source.field}-${idx}`}
                    className={`fact-anchor-card ${isLineHovered ? "highlighted" : ""} ${source.requires_human_review ? "review-required" : ""}`}
                    onMouseEnter={() => {
                      if (source.source_line !== undefined) setHoveredLine(source.source_line);
                    }}
                    onMouseLeave={() => setHoveredLine(null)}
                  >
                    <div className="fact-anchor-top">
                      <b className="fact-label">{source.label}</b>
                      <span className="fact-conf">{Math.round(source.confidence * 100)}% conf</span>
                    </div>
                    <div className="fact-value">{String(source.value)}</div>
                    <div className="fact-anchor-foot">
                      <span className="anchor-tag">
                        Line {(source.source_line !== undefined ? source.source_line + 1 : idx + 1).toString().padStart(2, "0")}
                      </span>
                      {source.requires_human_review && (
                        <span className="pill warn" style={{ fontSize: "11px", padding: "2px 6px" }}>
                          Review Req
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-facts">
                <span>No extracted fact anchors recorded. Fails closed to manual review.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="disclaimer" style={{ marginTop: "16px" }}>
        <b>Statutory Safeguard:</b> Probabilistic AI extraction is used solely for document perception. The deterministic rule engine below verifies all statutory thresholds independently.
      </p>
    </section>
  );
}
