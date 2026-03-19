# Recording Guide — Parchi Invoices

## Overview
Total recording time: ~50-60 minutes
Theme: GST invoice generator for Jaipur businesses

## Recording Order

### Step 1: models.py (~8 min)
- Explain the client brief — GST billing for a Jaipur SaaS
- Create LineItem as a plain Pydantic model (not a table)
- Create TaxBreakdown as a response model
- Create Invoice table — explain the JSON column for line_items
- Explain why line_items is stored as JSON, not a separate table
- Create InvoiceCreate with list[LineItem] — show nested models
- Create InvoiceRead for responses

### Step 2: services/tax_calculator.py (~7 min)
- Explain GST rules: same state = CGST + SGST, different state = IGST
- Write the calculate_tax function
- Take line_items, shop_state, customer_state as parameters
- Calculate subtotal from all line items
- Apply 18% GST, split based on same-state check
- Return a TaxBreakdown object
- Walk through an example calculation on camera

### Step 3: services/pdf_generator.py (~10 min)
- Introduce fpdf2 — lightweight PDF library
- Create FPDF instance, add a page
- Add logo if path exists
- Write the header: "TAX INVOICE"
- Add shop and customer info
- Build the line items table with headers and rows
- Add tax breakdown section
- Add bold total at the bottom
- Save to generated_invoices directory
- This file is the longest — take your time explaining each section

### Step 4: database.py (~3 min)
- Standard setup — engine, create_tables, get_session
- Quick and familiar pattern

### Step 5: routes/invoices.py (~8 min)
- POST / — create invoice: validate input, calculate tax, save to DB
- Show how line items are converted to dicts for JSON storage
- GET /{id} — fetch invoice details
- GET /{id}/pdf — generate and return PDF using FileResponse
- Explain media_type and filename in FileResponse
- Test in /docs: create an invoice, then download the PDF

### Step 6: routes/uploads.py (~5 min)
- POST /logo — accept an UploadFile
- Validate content_type (only PNG/JPG)
- Save using shutil.copyfileobj
- Return the file path so it can be used when creating invoices
- Test: upload a logo, then create an invoice with that logo_path

### Step 7: main.py (~3 min)
- Create app, include both routers
- Startup event for table creation
- Run the server and demo

## Demo Flow
1. Create an invoice — same state (Rajasthan to Rajasthan) — show CGST + SGST
2. Create another — different state (Rajasthan to Delhi) — show IGST
3. Download PDF for both — open and compare the tax lines
4. Upload a logo image
5. Create an invoice with the logo_path — download PDF and show the logo
