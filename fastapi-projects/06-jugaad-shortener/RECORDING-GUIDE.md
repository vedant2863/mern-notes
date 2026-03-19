# Recording Guide — Jugaad Shortener

## Overview
Total recording time: ~45-55 minutes
Theme: URL shortener for a digital marketing agency

## Recording Order

### Step 1: models.py (~5 min)
- Explain the client need — short links for marketing campaigns
- Create the ShortURL table: original_url, short_code, click_count, created_at
- Write the generate_code helper using random.choices
- Create ShortURLCreate and ShortURLRead schemas
- Explain default_factory for auto-generating codes and timestamps

### Step 2: database.py (~3 min)
- Set up SQLite engine
- Write create_tables and get_session
- Same pattern as previous project — reinforce the concept

### Step 3: routes/shortener.py (~10 min)
- POST /shorten — create a new short URL
- GET /{code} — redirect to original URL with 307 status
- GET /stats/{code} — return click count and details
- Introduce BackgroundTasks — explain why counting clicks in background is faster
- Write the increment_clicks background function
- Test all three endpoints in /docs

### Step 4: Test with /docs (~5 min)
- Create a short URL via POST
- Visit the short code — show the redirect happening
- Check stats — show click count increasing
- This is a good point to pause and verify everything works

### Step 5: templates/dashboard.html (~7 min)
- Create the HTML template with a table
- Use Jinja2 for loop to render URLs
- Show short_code, original_url, click_count, created_at
- Explain the template syntax: {% for %}, {{ variable }}

### Step 6: templates/create.html (~7 min)
- Build a simple form with a URL input
- Add JavaScript to call the /shorten API
- Display the result short URL on the page
- Explain fetch() and how the frontend talks to the API

### Step 7: static/style.css (~3 min)
- Add minimal CSS for the container, table, form, and button
- Keep it simple — this is about FastAPI, not CSS

### Step 8: routes/dashboard.py (~5 min)
- Set up Jinja2Templates pointing to templates directory
- GET /dashboard — query all URLs and render the template
- GET /create — render the create form
- Explain TemplateResponse and the request context

### Step 9: main.py (~5 min)
- Create the app and mount StaticFiles
- Include both routers
- Important: dashboard router must come before shortener router
- Explain why order matters (/{code} would catch /dashboard otherwise)
- Run and demo the full flow through the browser

## Demo Flow
1. Open /create in browser, shorten a URL
2. Click the short link — show it redirects
3. Open /dashboard — show the click count
4. Click the link a few more times, refresh dashboard
5. Show /stats/{code} in the API docs
