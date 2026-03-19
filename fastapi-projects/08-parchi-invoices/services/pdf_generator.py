from fpdf import FPDF
from models import Invoice
import os


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Generate a PDF invoice and return the file path."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Add logo if available
    if invoice.logo_path and os.path.exists(invoice.logo_path):
        pdf.image(invoice.logo_path, x=10, y=8, w=30)
        pdf.ln(25)
    else:
        pdf.ln(5)

    # Header
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, "TAX INVOICE", ln=True, align="C")
    pdf.ln(5)

    # Shop and customer info
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(95, 8, f"From: {invoice.shop_name}")
    pdf.cell(95, 8, f"To: {invoice.customer_name}", ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(95, 6, f"State: {invoice.shop_state}")
    pdf.cell(95, 6, f"State: {invoice.customer_state}", ln=True)

    pdf.cell(95, 6, f"Invoice #: {invoice.id}")
    created = invoice.created_at.strftime("%Y-%m-%d")
    pdf.cell(95, 6, f"Date: {created}", ln=True)
    pdf.ln(8)

    # Line items table header
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(44, 62, 80)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(80, 8, "Description", border=1, fill=True)
    pdf.cell(30, 8, "Qty", border=1, fill=True, align="C")
    pdf.cell(40, 8, "Unit Price", border=1, fill=True, align="R")
    pdf.cell(40, 8, "Amount", border=1, fill=True, align="R")
    pdf.ln()

    # Line items rows
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(0, 0, 0)
    for item in invoice.line_items:
        desc = item.get("description", "") if isinstance(item, dict) else item.description
        qty = item.get("quantity", 0) if isinstance(item, dict) else item.quantity
        price = item.get("unit_price", 0) if isinstance(item, dict) else item.unit_price
        amount = qty * price

        pdf.cell(80, 8, str(desc), border=1)
        pdf.cell(30, 8, str(qty), border=1, align="C")
        pdf.cell(40, 8, f"Rs {price:.2f}", border=1, align="R")
        pdf.cell(40, 8, f"Rs {amount:.2f}", border=1, align="R")
        pdf.ln()

    pdf.ln(5)

    # Tax breakdown
    pdf.set_font("Helvetica", "", 10)
    x_label = 120
    x_value = 160
    w_label = 40
    w_value = 40

    pdf.set_x(x_label)
    pdf.cell(w_label, 7, "Subtotal:", align="R")
    pdf.cell(w_value, 7, f"Rs {invoice.subtotal:.2f}", align="R", ln=True)

    if invoice.cgst > 0:
        pdf.set_x(x_label)
        pdf.cell(w_label, 7, "CGST (9%):", align="R")
        pdf.cell(w_value, 7, f"Rs {invoice.cgst:.2f}", align="R", ln=True)

        pdf.set_x(x_label)
        pdf.cell(w_label, 7, "SGST (9%):", align="R")
        pdf.cell(w_value, 7, f"Rs {invoice.sgst:.2f}", align="R", ln=True)

    if invoice.igst > 0:
        pdf.set_x(x_label)
        pdf.cell(w_label, 7, "IGST (18%):", align="R")
        pdf.cell(w_value, 7, f"Rs {invoice.igst:.2f}", align="R", ln=True)

    # Total
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_x(x_label)
    pdf.cell(w_label, 10, "TOTAL:", align="R")
    pdf.cell(w_value, 10, f"Rs {invoice.total:.2f}", align="R", ln=True)

    # Save to file
    output_dir = "generated_invoices"
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"invoice_{invoice.id}.pdf")
    pdf.output(file_path)

    return file_path
