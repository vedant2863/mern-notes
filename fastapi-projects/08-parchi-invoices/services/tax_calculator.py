from models import LineItem, TaxBreakdown

GST_RATE = 0.18  # 18% GST


def calculate_tax(
    line_items: list[LineItem],
    shop_state: str,
    customer_state: str,
) -> TaxBreakdown:
    """
    Calculate GST based on whether the sale is intra-state or inter-state.
    Same state: split into CGST (9%) + SGST (9%)
    Different state: charge IGST (18%)
    """
    subtotal = sum(item.quantity * item.unit_price for item in line_items)
    tax_amount = subtotal * GST_RATE

    same_state = shop_state.strip().lower() == customer_state.strip().lower()

    if same_state:
        # Intra-state: split equally into CGST and SGST
        cgst = round(tax_amount / 2, 2)
        sgst = round(tax_amount / 2, 2)
        igst = 0.0
    else:
        # Inter-state: full IGST
        cgst = 0.0
        sgst = 0.0
        igst = round(tax_amount, 2)

    total = round(subtotal + tax_amount, 2)

    return TaxBreakdown(
        subtotal=round(subtotal, 2),
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        total=total,
    )
