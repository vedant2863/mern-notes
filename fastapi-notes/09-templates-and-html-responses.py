"""
============================================================
FILE 09: JINJA2 TEMPLATES, HTML RESPONSES, AND STATIC FILES
============================================================
Topics: HTMLResponse, Jinja2Templates, TemplateResponse,
        template variables, control flow, inheritance,
        custom filters, StaticFiles, RedirectResponse,
        StreamingResponse

WHY THIS MATTERS:
Not every API returns JSON. Server-rendered HTML is still the
backbone of admin panels, email templates, PNR status pages,
and any SEO-critical content. Understanding templates is key
to building full-stack applications with FastAPI.
============================================================
"""

# STORY: IRCTC PNR Status Page — Server-Rendered HTML with Booking Data
# IRCTC serves 25+ million bookings per month. When passengers check
# PNR status, they get a server-rendered HTML page showing coach,
# berth, and waiting list position. This page must load fast and work
# on 2G connections. JSON APIs power the mobile app, but the web
# experience is pure server-side Jinja2 rendering.

# Requires: pip install jinja2

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import (
    HTMLResponse, RedirectResponse, PlainTextResponse, StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
from datetime import datetime

app = FastAPI(title="IRCTC-Style Templates Demo")


# ════════════════════════════════════════════════════════════
# SECTION 1 — HTMLResponse for Simple HTML
# ════════════════════════════════════════════════════════════

# WHY: For small, static HTML snippets you do not need a full template
# engine. HTMLResponse lets you return HTML directly from a function.

@app.get("/", response_class=HTMLResponse)
def home_page():
    """Return simple HTML without a template engine."""
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>IRCTC PNR Status</title>
        <style>
            body { font-family: Arial; max-width: 800px; margin: 50px auto; }
            .header { background: #003580; color: white; padding: 20px; text-align: center; }
            input[type=text] { padding: 10px; width: 200px; font-size: 16px; }
            button { padding: 10px 30px; background: #e65100; color: white; border: none; }
        </style>
    </head>
    <body>
        <div class="header"><h1>Indian Railways PNR Status</h1></div>
        <form action="/pnr" method="get" style="padding: 30px;">
            <label>Enter 10-digit PNR:</label><br><br>
            <input type="text" name="pnr" pattern="[0-9]{10}" required>
            <button type="submit">Check Status</button>
        </form>
    </body>
    </html>
    """


# ════════════════════════════════════════════════════════════
# SECTION 2 — Jinja2Templates Setup
# ════════════════════════════════════════════════════════════

# WHY: Real applications have dozens of pages. Templates separate
# HTML structure from Python logic, enabling reuse and maintainability.

TEMPLATE_DIR = "/tmp/irctc_templates"
STATIC_DIR = "/tmp/irctc_static"

def setup_template_files():
    """Create template files on disk. In a real project, these are .html files in templates/."""
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)

    # --- base.html: Template Inheritance (parent layout) ---
    base_html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}IRCTC{% endblock %}</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <nav class="navbar">
        <span class="logo">IRCTC</span>
        <a href="/">Home</a> <a href="/trains">Trains</a>
    </nav>
    <div class="container">
        {% block content %}<p>Default content.</p>{% endblock %}
    </div>
    <footer class="footer"><p>Indian Railways &copy; {{ year }}</p></footer>
</body>
</html>"""

    # --- pnr_status.html: Variables, conditionals, loops ---
    pnr_html = """{% extends "base.html" %}
{% block title %}PNR Status - {{ pnr_number }}{% endblock %}
{% block content %}
<h1>PNR Status: {{ pnr_number }}</h1>
{% if error %}
    <div class="error">{{ error }}</div>
{% else %}
    <h2>{{ train_name }} ({{ train_number }})</h2>
    <table>
        <tr><td>From:</td><td>{{ from_station }}</td></tr>
        <tr><td>To:</td><td>{{ to_station }}</td></tr>
        <tr><td>Date:</td><td>{{ journey_date }}</td></tr>
        <tr><td>Class:</td><td>{{ travel_class }}</td></tr>
    </table>
    <h3>Passengers</h3>
    <table>
        <tr><th>No.</th><th>Booking</th><th>Current</th></tr>
        {% for p in passengers %}
        <tr>
            <td>{{ loop.index }}</td>
            <td>{{ p.booking_status }}</td>
            <td class="{{ 'confirmed' if 'CNF' in p.current_status else 'waiting' }}">{{ p.current_status }}</td>
        </tr>
        {% endfor %}
    </table>
    <p class="chart-status {{ 'prepared' if chart_prepared else 'not-prepared' }}">
        Chart {{ "Prepared" if chart_prepared else "Not Prepared" }}
    </p>
{% endif %}
{% endblock %}"""

    # --- trains.html: List page with for loop and filters ---
    trains_html = """{% extends "base.html" %}
{% block title %}Available Trains{% endblock %}
{% block content %}
<h1>Trains ({{ trains | length }} found)</h1>
{% if trains %}
    <table>
        <tr><th>No.</th><th>Name</th><th>From</th><th>To</th><th>Departure</th><th>Days</th></tr>
        {% for t in trains %}
        <tr>
            <td>{{ t.number }}</td><td>{{ t.name | upper }}</td>
            <td>{{ t.from_station }}</td><td>{{ t.to_station }}</td>
            <td>{{ t.departure }}</td><td>{{ t.days | join(", ") }}</td>
        </tr>
        {% endfor %}
    </table>
{% else %}
    <p>No trains found.</p>
{% endif %}
{% endblock %}"""

    css_content = """body { font-family: Arial; margin: 0; background: #f5f5f5; }
.navbar { background: #003580; color: white; padding: 15px 30px; display: flex; gap: 20px; }
.navbar a { color: #cce5ff; text-decoration: none; }
.navbar .logo { font-weight: bold; font-size: 20px; margin-right: 30px; }
.container { max-width: 900px; margin: 30px auto; padding: 20px; background: white; border-radius: 5px; }
.footer { text-align: center; padding: 20px; color: #666; }
.error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; }
table { border-collapse: collapse; width: 100%; margin: 15px 0; }
th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
th { background: #003580; color: white; }
.confirmed { color: green; font-weight: bold; }
.waiting { color: #e65100; font-weight: bold; }
.prepared { background: #e8f5e9; color: #2e7d32; padding: 10px; }
.not-prepared { background: #fff3e0; color: #e65100; padding: 10px; }"""

    for path, content in {
        os.path.join(TEMPLATE_DIR, "base.html"): base_html,
        os.path.join(TEMPLATE_DIR, "pnr_status.html"): pnr_html,
        os.path.join(TEMPLATE_DIR, "trains.html"): trains_html,
        os.path.join(STATIC_DIR, "css", "style.css"): css_content,
    }.items():
        with open(path, "w") as f:
            f.write(content)

setup_template_files()
templates = Jinja2Templates(directory=TEMPLATE_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ════════════════════════════════════════════════════════════
# SECTION 3 — Template Rendering with TemplateResponse
# ════════════════════════════════════════════════════════════

# WHY: TemplateResponse combines a template file with context data.
# The Request object is ALWAYS required by Jinja2Templates.

PNR_DATABASE: dict[str, dict] = {
    "2401234567": {
        "train_number": "12301",
        "train_name": "Howrah Rajdhani Express",
        "from_station": "New Delhi (NDLS)",
        "to_station": "Howrah (HWH)",
        "journey_date": "2025-03-15",
        "travel_class": "3A - AC 3 Tier",
        "chart_prepared": False,
        "passengers": [
            {"booking_status": "S5/32/L", "current_status": "CNF S5/32"},
            {"booking_status": "WL/5", "current_status": "WL/3"},
        ],
    },
}


@app.get("/pnr", response_class=HTMLResponse)
def check_pnr_status(request: Request, pnr: str = ""):
    """
    PNR Status page. TemplateResponse requires:
    1. request: Request — ALWAYS needed
    2. Template filename
    3. Context dict with all template variables
    """
    context = {"request": request, "year": datetime.now().year, "pnr_number": pnr}

    if not pnr or len(pnr) != 10 or not pnr.isdigit():
        context["error"] = "Please enter a valid 10-digit PNR number."
        return templates.TemplateResponse("pnr_status.html", context)

    pnr_data = PNR_DATABASE.get(pnr)
    if not pnr_data:
        context["error"] = f"PNR {pnr} not found."
        return templates.TemplateResponse("pnr_status.html", context)

    context.update(pnr_data)
    return templates.TemplateResponse("pnr_status.html", context)


# ════════════════════════════════════════════════════════════
# SECTION 4 — Loops, Filters, and Inheritance in Action
# ════════════════════════════════════════════════════════════

# WHY: Loops, conditionals, and filters let you build complex UIs
# without JavaScript frameworks.

# Template inheritance structure:
# base.html         -> {% block title %}, {% block content %}
# pnr_status.html   -> {% extends "base.html" %}, overrides blocks
# trains.html       -> {% extends "base.html" %}, uses {% for %} loops

TRAINS = [
    {"number": "12301", "name": "Howrah Rajdhani", "from_station": "New Delhi",
     "to_station": "Howrah", "departure": "16:55", "days": ["Mon", "Wed", "Fri"]},
    {"number": "12951", "name": "Mumbai Rajdhani", "from_station": "New Delhi",
     "to_station": "Mumbai Central", "departure": "16:35", "days": ["Daily"]},
]


@app.get("/trains", response_class=HTMLResponse)
def list_trains(request: Request):
    """
    Demonstrates: {{ variable }}, {{ trains | length }},
    {{ name | upper }}, {{ days | join(", ") }}, {% for %}, {% if %}
    """
    return templates.TemplateResponse("trains.html", {
        "request": request, "year": datetime.now().year, "trains": TRAINS,
    })


# ════════════════════════════════════════════════════════════
# SECTION 5 — Custom Filters and Other Response Types
# ════════════════════════════════════════════════════════════

# WHY: Built-in filters cover basics, but Indian apps need custom
# currency formatting. Other response types handle redirects and streams.

def format_inr(value: float) -> str:
    """Format as Indian Rupees with commas (1,00,000 not 100,000)."""
    s = f"{value:.2f}"
    integer_part, decimal_part = s.split(".")
    last_three = integer_part[-3:]
    remaining = integer_part[:-3]
    if remaining:
        result = ""
        for i, digit in enumerate(reversed(remaining)):
            if i > 0 and i % 2 == 0:
                result = "," + result
            result = digit + result
        return f"Rs. {result},{last_three}.{decimal_part}"
    return f"Rs. {last_three}.{decimal_part}"

templates.env.filters["inr"] = format_inr
# Usage in templates: {{ 1500000 | inr }}  ->  Rs. 15,00,000.00


# --- RedirectResponse ---
@app.get("/old-pnr-page")
def redirect_old_pnr():
    """Redirect from old URL to new (301 permanent)."""
    return RedirectResponse(url="/", status_code=301)


# --- PlainTextResponse ---
@app.get("/health", response_class=PlainTextResponse)
def health_check():
    return "OK"


# --- StreamingResponse for large exports ---
@app.get("/export/trains")
def export_trains_csv():
    """Stream train data as CSV — ideal for large datasets."""
    def generate_csv():
        yield "Train No,Name,From,To,Departure,Days\n"
        for t in TRAINS:
            yield f"{t['number']},{t['name']},{t['from_station']},{t['to_station']},{t['departure']},{'/'.join(t['days'])}\n"

    return StreamingResponse(
        content=generate_csv(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trains.csv"},
    )


# ════════════════════════════════════════════════════════════
# KEY TAKEAWAYS
# ════════════════════════════════════════════════════════════
# 1. HTMLResponse returns raw HTML — good for tiny pages.
#    Jinja2Templates is the proper solution for real applications.
# 2. TemplateResponse ALWAYS needs request: Request in the context.
# 3. Template inheritance ({% extends %}) eliminates HTML duplication.
#    Define blocks in base.html, override in child templates.
# 4. Custom filters (templates.env.filters["inr"]) format data
#    the Indian way — currency, dates, etc.
# 5. RedirectResponse (301/307) handles URL migrations.
#    StreamingResponse handles large exports without memory explosion.
# 6. StaticFiles mounts CSS/JS/images. Templates reference via
#    /static/css/style.css in <link> tags.
# "A page that loads in 2 seconds on a Jio network in rural Bihar
#  is worth more than a React SPA that needs 5 MB of JavaScript."
#  — IRCTC Performance Team Philosophy
