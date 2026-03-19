from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session

from database import get_session
from models import Invoice, InvoiceCreate, InvoiceRead, LineItem
from services.tax_calculator import calculate_tax
from services.pdf_generator import generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("/", response_model=InvoiceRead)
def create_invoice(
    data: InvoiceCreate,
    session: Session = Depends(get_session),
):
    # Calculate taxes
    tax = calculate_tax(data.line_items, data.shop_state, data.customer_state)

    # Convert line items to plain dicts for JSON storage
    items_as_dicts = [item.model_dump() for item in data.line_items]

    invoice = Invoice(
        shop_name=data.shop_name,
        customer_name=data.customer_name,
        shop_state=data.shop_state,
        customer_state=data.customer_state,
        line_items=items_as_dicts,
        subtotal=tax.subtotal,
        cgst=tax.cgst,
        sgst=tax.sgst,
        igst=tax.igst,
        total=tax.total,
        logo_path=data.logo_path,
    )

    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(invoice_id: int, session: Session = Depends(get_session)):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, session: Session = Depends(get_session)):
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pdf_path = generate_invoice_pdf(invoice)

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"invoice_{invoice_id}.pdf",
    )
