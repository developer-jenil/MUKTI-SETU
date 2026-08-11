"""Generate the three sample scanned court-order PDFs used by the intake demo.

Run:  python scripts/generate_sample_pdfs.py   (from the project root)
Output: mock_data/court_orders/case_001_order.pdf etc.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

OUT_DIR = Path(__file__).parents[1] / "mock_data" / "court_orders"

ORDERS = [
    {
        "filename": "case_001_order.pdf",
        "title": "IN THE COURT OF THE SESSIONS JUDGE, CHENNAI",
        "case": "Crl. O.P. No. 221/2024 (FIR 221/2024)",
        "body": [
            "The accused was produced before this court in connection with offences under",
            "Sections 379 and 411 of the Indian Penal Code. The public prosecutor opposed bail.",
            "The matter was adjourned to 2025-04-10 as the court's cause list was overburdened.",
            "Counsel for the accused stated readiness to proceed. The court records that the",
            "accused remains in judicial custody since 15 January 2024.",
        ],
    },
    {
        "filename": "case_002_order.pdf",
        "title": "IN THE COURT OF THE DISTRICT JUDGE, LUCKNOW",
        "case": "Crl. Case No. 88/2023 (FIR 88/2023)",
        "body": [
            "This matter involves an allegation under Section 420 of the Indian Penal Code.",
            "Charge-sheet stands filed. Today the case was not taken up as the presiding officer",
            "was on leave and the court adjourned the matter to 2025-06-02. The accused is in",
            "custody since 02 August 2023.",
        ],
    },
    {
        "filename": "case_003_order.pdf",
        "title": "IN THE COURT OF THE SESSIONS JUDGE, PUNE",
        "case": "Crl. Case No. 19/2025 (FIR 19/2025)",
        "body": [
            "Matter under Section 307 of the Indian Penal Code. The defense counsel sought an",
            "adjournment to obtain the charge-sheet copy. The prosecution had no objection.",
            "Listed again on 2025-09-15. Custody extended; the accused has been in detention",
            "since 10 February 2025.",
        ],
    },
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for order in ORDERS:
        path = OUT_DIR / order["filename"]
        pdf = canvas.Canvas(str(path), pagesize=A4)
        width, height = A4
        pdf.setFont("Times-Bold", 15)
        pdf.drawCentredString(width / 2, height - 25 * mm, order["title"])
        pdf.setFont("Times-Bold", 12)
        pdf.drawCentredString(width / 2, height - 35 * mm, order["case"])
        pdf.setFont("Times-Roman", 12)
        y = height - 50 * mm
        for line in order["body"]:
            pdf.drawString(25 * mm, y, line)
            y -= 8 * mm
        pdf.drawString(25 * mm, y - 10 * mm, "Ordered accordingly.")
        pdf.drawString(25 * mm, y - 22 * mm, "Sd/-")
        pdf.drawString(25 * mm, y - 28 * mm, "Presiding Officer")
        pdf.showPage()
        pdf.save()
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
