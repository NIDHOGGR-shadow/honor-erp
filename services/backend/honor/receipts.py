"""Private purchase receipts generated from server-verified payment and sale snapshots."""

from html import escape
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select

from .inventory import lines
from .models import Company, PaymentAttempt


def receipt_data(db, order):
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.order_id == order.id))
    if not attempt or not attempt.paid_reference or order.payment_status == "UNPAID":
        raise HTTPException(409, "A receipt is available only after the server confirms payment")
    return {
        "number": "HONOR-" + order.id.upper(),
        "order_id": order.id,
        "seller": order.seller_name or db.get(Company, order.company_id).name,
        "customer": order.customer_name,
        "email": order.email,
        "created_at": order.created_at.isoformat(),
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "fulfilled_at": order.fulfilled_at.isoformat() if order.fulfilled_at else None,
        "status": order.status,
        "payment_status": order.payment_status,
        "provider": attempt.provider,
        "payment_reference": attempt.reference,
        "transaction_reference": attempt.paid_reference,
        "channel": attempt.channel,
        "currency": order.currency,
        "total_minor": order.total_minor,
        "lines": [
            {
                "name": x.name,
                "sku": x.sku,
                "quantity": x.quantity,
                "price_minor": x.price_minor,
                "returned_quantity": x.returned_quantity,
                "serials": x.serials if order.status == "FULFILLED" else [],
                "device_pending": x.tracking == "SERIAL" and not x.serials,
            }
            for x in lines(db, order)
        ],
    }


def receipt_pdf(data):
    # PDF rendering also imports Pillow. Keep it off the inventory/auth startup path.
    import reportlab
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    if "HonorReceipt" not in pdfmetrics.getRegisteredFontNames():
        font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        if not font.exists():
            font = Path(reportlab.__file__).parent / "fonts" / "Vera.ttf"
        pdfmetrics.registerFont(TTFont("HonorReceipt", str(font)))
    style = ParagraphStyle(
        "receipt",
        fontName="HonorReceipt",
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#243a32"),
        spaceAfter=7,
        wordWrap="CJK",
    )
    title = ParagraphStyle("title", parent=style, fontSize=23, leading=29, spaceAfter=14)
    small = ParagraphStyle("small", parent=style, fontSize=8, leading=12)

    def p(value, use=style):
        return Paragraph(escape(str(value)), use)

    def money(value):
        return f"{data['currency']} {value // 100:,}.{value % 100:02d}"

    def date(value):
        return datetime.fromisoformat(value).astimezone(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    content = [p(data["seller"], title), p("Purchase receipt"), p(data["number"], small)]
    if data["provider"] == "sandbox":
        content.append(p("DEVELOPMENT SIMULATION - no real money received"))
    content.extend(
        [
            Spacer(1, 5 * mm),
            p("Customer: " + data["customer"]),
            p(data["email"]),
            p("Order placed: " + date(data["created_at"]), small),
            p(
                "Payment confirmed: "
                + (date(data["paid_at"]) if data["paid_at"] else "Confirmation time not recorded"),
                small,
            ),
            p("Payment status: " + data["payment_status"].replace("_", " ")),
            p("Order status: " + data["status"].replace("_", " ")),
        ]
    )
    rows = [[p("Item / SKU"), p("Qty"), p("Unit price"), p("Total")]]
    for line in data["lines"]:
        details = line["name"] + "\nSKU: " + line["sku"]
        # Escape customer/product data before adding the controlled line-break markup.
        item = Paragraph("<br/>".join(escape(x) for x in details.split("\n")), style)
        rows.append(
            [
                item,
                p(line["quantity"]),
                p(money(line["price_minor"])),
                p(money(line["price_minor"] * line["quantity"])),
            ]
        )
    table = Table(rows, colWidths=[80 * mm, 12 * mm, 36 * mm, 36 * mm], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf4ef")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#dce5df")),
            ]
        )
    )
    content.extend(
        [Spacer(1, 6 * mm), table, Spacer(1, 4 * mm), p("Total received: " + money(data["total_minor"]))]
    )
    for line in data["lines"]:
        if line["serials"]:
            content.append(p(line["name"] + " - serial / IMEI: " + ", ".join(line["serials"])))
        elif line["device_pending"]:
            content.append(p(line["name"] + " - exact device / IMEI pending confirmed handover"))
        if line["returned_quantity"]:
            content.append(p(f"{line['name']} - returned units: {line['returned_quantity']}"))
    content.extend(
        [
            Spacer(1, 5 * mm),
            p("Provider: " + data["provider"], small),
            p("Payment reference: " + data["payment_reference"], small),
            p("Transaction: " + data["transaction_reference"], small),
        ]
    )
    if data["channel"]:
        content.append(p("Payment method: " + data["channel"].replace("_", " "), small))
    if data["fulfilled_at"]:
        content.append(p("Handover confirmed: " + date(data["fulfilled_at"]), small))
    else:
        content.append(p("This receipt confirms payment. It does not confirm collection or delivery.", small))
    if data["payment_status"] != "PAID":
        content.append(
            p("Payment requires refund review or has been refunded. Check the current order status.", small)
        )
    content.append(p("Keep this purchase receipt for your records.", small))
    output = BytesIO()
    doc = SimpleDocTemplate(
        output,
        title="Honor purchase receipt",
        author="Honor",
        leftMargin=23 * mm,
        rightMargin=23 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    def footer(canvas, doc):
        canvas.setFont("HonorReceipt", 8)
        canvas.drawRightString(187 * mm, 12 * mm, f"Honor | Page {doc.page}")

    doc.build(content, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
