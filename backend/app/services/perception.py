from __future__ import annotations

from io import BytesIO
import base64
import re
import zlib
from pathlib import Path
from typing import Any

from app.config.settings import settings
from app.services.extractor import extract_intake_facts
from app.services.llm import LLMUnavailable, get_llm_provider
from app.services.llm.fallback import FallbackProvider


class PerceptionService:
    """Perception layer: extract text, pull key facts, classify adjournments.

    Every AI step fails closed — if OCR or the LLM cannot answer, the document is
    retained for manual transcription and the deterministic rule engine is
    completely unaffected (the law always works).
    """

    def analyze(self, filename: str, content: bytes) -> dict[str, Any]:
        provider = settings.ocr_provider
        warnings: list[str] = []
        suffix = Path(filename).suffix.lower()
        evidence: list[dict[str, Any]] = []
        pages = 1

        if suffix == ".pdf":
            text, evidence, pages = self._extract_pdf(content, warnings)
        elif suffix in {".png", ".jpg", ".jpeg"}:
            text = ""
        else:
            text = content.decode("utf-8", errors="ignore")

        if provider == "easyocr":
            try:
                import easyocr  # type: ignore
                import numpy as np  # type: ignore
                from PIL import Image  # type: ignore

                reader = easyocr.Reader(settings.ocr_languages, gpu=False)
                if suffix == ".pdf":
                    import fitz  # type: ignore

                    pdf = fitz.open(stream=content, filetype="pdf")
                    pages = len(pdf)
                    ocr_rows: list[str] = []
                    for page_index, page in enumerate(pdf):
                        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, pixmap.n)
                        rows = reader.readtext(image, detail=1)
                        for box, row_text, confidence in rows:
                            ocr_rows.append(str(row_text))
                            evidence.append({
                                "page": page_index + 1,
                                "bbox": box,
                                "text": str(row_text),
                                "confidence": round(float(confidence), 3),
                            })
                    text = "\n".join(ocr_rows) or text
                else:
                    image = np.array(Image.open(BytesIO(content)))
                    rows = reader.readtext(image, detail=1)
                    text = "\n".join(str(row[1]) for row in rows)
                    evidence.extend({"page": 1, "bbox": row[0], "text": str(row[1]), "confidence": round(float(row[2]), 3)} for row in rows)
            except Exception as exc:
                warnings.append("EasyOCR unavailable; document retained for manual transcription.")
                if suffix in {".png", ".jpg", ".jpeg"}:
                    warnings.append(f"OCR error: {type(exc).__name__}.")
        if not text.strip():
            warnings.append("No machine-readable text found. Human transcription required.")

        extracted_facts = extract_intake_facts(text) if text.strip() else {}
        fir_number = extracted_facts.get("fir_number")
        if not fir_number:
            fir = re.search(r"FIR\s*(?:No\.?\s*)?([\w/-]+)", text, re.IGNORECASE)
            fir_number = fir.group(1) if fir else None

        extracted: dict[str, Any] = {"fir_number": fir_number}
        confidence = 0.65 if fir_number else 0.0

        llm_provider = get_llm_provider()
        adjournment: dict[str, Any] | None = None
        if text.strip():
            try:
                classification = llm_provider.classify_adjournment(text)
            except LLMUnavailable as exc:
                classification = FallbackProvider().classify_adjournment(text)
                classification.note = f"{classification.note} Groq unavailable ({exc})."
            adjournment = classification.model_dump()

        requires_review = bool(adjournment and adjournment.get("flag")) or not fir_number
        return {
            "provider": provider if text else "manual-review",
            "llm_provider": llm_provider.name,
            "filename": filename,
            "file_type": suffix.lstrip(".") or "text",
            "pages": pages,
            "text_preview": text[:500],
            "extracted": extracted,
            "extracted_facts": extracted_facts,
            "evidence": evidence[:200],
            "adjournment": adjournment,
            "confidence": round(confidence, 2),
            "warnings": warnings,
            "requires_human_review": requires_review,
        }

    @staticmethod
    def _extract_pdf(content: bytes, warnings: list[str]) -> tuple[str, list[dict[str, Any]], int]:
        """Extract text and page provenance from a PDF before invoking OCR."""
        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(BytesIO(content))
            evidence: list[dict[str, Any]] = []
            page_text: list[str] = []
            for page_index, page in enumerate(reader.pages):
                extracted = page.extract_text() or ""
                page_text.append(extracted)
                if extracted.strip():
                    evidence.append({"page": page_index + 1, "text": extracted[:500], "confidence": 0.95})
            return "\n".join(page_text), evidence, len(reader.pages)
        except Exception as exc:
            # Keep the offline demo useful even before optional PDF libraries
            # are installed: decode common Flate-compressed text streams. The
            # production container still installs pypdf for full PDF support.
            fallback_text = PerceptionService._extract_simple_pdf_streams(content)
            if fallback_text:
                warnings.append(f"Used limited PDF stream extraction ({type(exc).__name__}); verify page evidence manually.")
                pages = max(content.count(b"/Type /Page"), 1)
                evidence = [{"page": 1, "text": fallback_text[:500], "confidence": 0.65}]
                return fallback_text, evidence, pages
            warnings.append(f"PDF text extraction unavailable; OCR/manual review required ({type(exc).__name__}).")
            return content.decode("utf-8", errors="ignore"), [], 1

    @staticmethod
    def _extract_simple_pdf_streams(content: bytes) -> str:
        chunks: list[str] = []
        for match in re.finditer(rb"stream\r?\n(.*?)endstream", content, flags=re.DOTALL):
            raw = match.group(1)
            try:
                decoded = zlib.decompress(raw).decode("latin-1", errors="ignore")
            except zlib.error:
                try:
                    decoded = zlib.decompress(base64.a85decode(raw, adobe=True)).decode("latin-1", errors="ignore")
                except (ValueError, zlib.error):
                    decoded = raw.decode("latin-1", errors="ignore")
            for literal in re.findall(r"\(((?:\\.|[^()])*)\)\s*Tj", decoded):
                chunks.append(PerceptionService._decode_pdf_literal(literal))
            for array in re.findall(r"\[(.*?)\]\s*TJ", decoded, flags=re.DOTALL):
                chunks.extend(PerceptionService._decode_pdf_literal(item) for item in re.findall(r"\(((?:\\.|[^()])*)\)", array))
        return "\n".join(chunk for chunk in chunks if chunk.strip())

    @staticmethod
    def _decode_pdf_literal(value: str) -> str:
        unescaped = re.sub(r"\\([\\()])", r"\1", value)
        return bytes(unescaped, "latin-1").decode("latin-1", errors="ignore")
