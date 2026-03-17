/** ============================================================
 *  FILE 11 — Template Rendering & Custom Engines
 *  Topic: app.engine(), app.set('view engine'), res.render()
 *  ============================================================ */

// ── THE STORY ──────────────────────────────────────────────
// Bollywood Poster Generator
// The poster designer builds reusable templates with blank
// slots for title, hero, and director. When the producer
// arrives with data, she fills the slots and prints. Express
// templates work the same: register an engine, point to a
// views folder, call res.render() with data.
// ───────────────────────────────────────────────────────────

const express = require('express');
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '_tmp_views_11');

// ============================================================
// BLOCK 1 — Custom Template Engine
// ============================================================
// app.engine(ext, fn) registers a render function.
// Contract: fn(filePath, options, callback)
//   1. Read the template file
//   2. Replace placeholders with data
//   3. Call callback(null, html) or callback(err)

// Helper: replace all occurrences of a tag in a string using split/join
function replaceAllTag(str, tag, value) {
  return str.split(tag).join(value);
}

// Helper: replace all {{key}} placeholders with values from a data object
function replacePlaceholders(str, data) {
  let result = str;
  // Keep replacing until no more {{...}} tags are found
  let openIdx = result.indexOf('{{');
  while (openIdx !== -1) {
    let closeIdx = result.indexOf('}}', openIdx);
    if (closeIdx === -1) break;
    let key = result.substring(openIdx + 2, closeIdx);
    // Only replace simple word keys (skip #each, /each, #if, /if, @index, this)
    if (key.indexOf('#') === -1 && key.indexOf('/') === -1 && key.indexOf('@') === -1 && key !== 'this') {
      let value = data[key] !== undefined ? String(data[key]) : '';
      result = result.substring(0, openIdx) + value + result.substring(closeIdx + 2);
      // Don't advance openIdx — re-check same position in case value was empty
      openIdx = result.indexOf('{{', openIdx);
    } else {
      openIdx = result.indexOf('{{', closeIdx + 2);
    }
  }
  return result;
}

function simpleHtmlEngine(filePath, options, callback) {
  fs.readFile(filePath, 'utf8', (err, template) => {
    if (err) return callback(err);
    let rendered = template;

    // {{#each collection}}...{{/each}} — loop over arrays
    // Find each block using indexOf instead of regex
    let eachStart = rendered.indexOf('{{#each ');
    while (eachStart !== -1) {
      // Extract the collection name: from after "{{#each " to "}}"
      let eachTagEnd = rendered.indexOf('}}', eachStart);
      if (eachTagEnd === -1) break;
      let key = rendered.substring(eachStart + 8, eachTagEnd).trim();

      // Find the closing {{/each}}
      let endTag = '{{/each}}';
      let eachEnd = rendered.indexOf(endTag, eachTagEnd);
      if (eachEnd === -1) break;

      // Extract the body between the tags
      let body = rendered.substring(eachTagEnd + 2, eachEnd);

      // Build the replacement string
      let arr = options[key];
      let replacement = '';
      if (Array.isArray(arr)) {
        for (let index = 0; index < arr.length; index++) {
          let item = arr[index];
          let row = replaceAllTag(body, '{{this}}', String(item));
          row = replaceAllTag(row, '{{@index}}', String(index));
          if (typeof item === 'object' && item !== null) {
            row = replacePlaceholders(row, item);
          }
          replacement += row;
        }
      }

      // Replace the entire {{#each...}}...{{/each}} block
      rendered = rendered.substring(0, eachStart) + replacement + rendered.substring(eachEnd + endTag.length);

      // Look for next {{#each
      eachStart = rendered.indexOf('{{#each ', eachStart);
    }

    // {{#if condition}}...{{/if}} — conditional rendering
    let ifStart = rendered.indexOf('{{#if ');
    while (ifStart !== -1) {
      let ifTagEnd = rendered.indexOf('}}', ifStart);
      if (ifTagEnd === -1) break;
      let key = rendered.substring(ifStart + 6, ifTagEnd).trim();

      let endTag = '{{/if}}';
      let ifEnd = rendered.indexOf(endTag, ifTagEnd);
      if (ifEnd === -1) break;

      let body = rendered.substring(ifTagEnd + 2, ifEnd);
      let replacement = options[key] ? body : '';

      rendered = rendered.substring(0, ifStart) + replacement + rendered.substring(ifEnd + endTag.length);
      ifStart = rendered.indexOf('{{#if ', ifStart);
    }

    // {{variable}} — simple replacement
    rendered = replacePlaceholders(rendered, options);
    callback(null, rendered);
  });
}

// ============================================================
// BLOCK 2 — Layouts, Conditionals, Lists
// ============================================================
// Layouts: render inner template, inject into outer template.
// This is what EJS/Handlebars layout systems do internally.

function renderFile(filePath, data) {
  return new Promise((resolve, reject) => {
    simpleHtmlEngine(filePath, data, (err, html) => err ? reject(err) : resolve(html));
  });
}

function createTemplateFiles() {
  fs.mkdirSync(VIEWS_DIR, { recursive: true });

  fs.writeFileSync(path.join(VIEWS_DIR, 'layout.simplehtml'),
    '<!DOCTYPE html>\n<html><head><title>{{pageTitle}}</title></head>\n<body>\n<header><h1>Bollywood Poster Studio</h1></header>\n<main>{{body}}</main>\n<footer>Generated at {{timestamp}}</footer>\n</body></html>');

  fs.writeFileSync(path.join(VIEWS_DIR, 'home.simplehtml'),
    '<h2>Welcome, {{username}}!</h2>\n{{#if isProducer}}<p class="producer-badge">Producer Access</p>{{/if}}\n<ul>\n{{#each films}}<li>{{title}} ({{status}})</li>{{/each}}\n</ul>\n{{#if noFilms}}<p>No films assigned.</p>{{/if}}');

  fs.writeFileSync(path.join(VIEWS_DIR, 'greeting.simplehtml'),
    '<h1>Hello, {{name}}!</h1>\n<p>You have {{count}} unread scripts.</p>');

  fs.writeFileSync(path.join(VIEWS_DIR, 'film-list.simplehtml'),
    '<h2>Film Catalog</h2>\n<table>\n{{#each films}}<tr><td>{{title}}</td><td>{{budget}}</td></tr>{{/each}}\n</table>');
}

function cleanupTemplateFiles() {
  fs.rmSync(VIEWS_DIR, { recursive: true, force: true });
}

function buildApp() {
  const app = express();

  // Register engine for ".simplehtml" files
  app.engine('simplehtml', simpleHtmlEngine);
  app.set('view engine', 'simplehtml');
  app.set('views', VIEWS_DIR);

  // Block 1: Basic render
  app.get('/greeting', (req, res) => {
    // res.render(view, data): finds file, runs engine, sends HTML
    res.render('greeting', { name: 'Shah Rukh Khan', count: 7 });
  });

  // Block 2: Layout + conditional (producer)
  app.get('/home', async (req, res) => {
    try {
      const innerHtml = await renderFile(path.join(VIEWS_DIR, 'home.simplehtml'), {
        username: 'Sanjay Leela Bhansali',
        isProducer: true,
        films: [
          { title: 'Devdas 2 poster', status: 'in-progress' },
          { title: 'Padmaavat banner', status: 'done' }
        ],
        noFilms: false
      });
      res.render('layout', { pageTitle: 'Dashboard', body: innerHtml, timestamp: new Date().toISOString() });
    } catch (err) { res.status(500).send('Render error: ' + err.message); }
  });

  // Block 2: Conditional (regular user, no producer badge)
  app.get('/home-regular', async (req, res) => {
    try {
      const innerHtml = await renderFile(path.join(VIEWS_DIR, 'home.simplehtml'), {
        username: 'Junior Artist Raju', isProducer: false, films: [], noFilms: true
      });
      res.render('layout', { pageTitle: 'Dashboard', body: innerHtml, timestamp: new Date().toISOString() });
    } catch (err) { res.status(500).send('Render error: ' + err.message); }
  });

  // Block 2: List rendering
  app.get('/films', (req, res) => {
    res.render('film-list', {
      films: [
        { title: 'Pathaan', budget: '250 Cr' },
        { title: 'RRR', budget: '550 Cr' }
      ]
    });
  });

  return app;
}

// ============================================================
// SELF-TEST
// ============================================================
async function runTests() {
  createTemplateFiles();
  const app = buildApp();

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    console.log(`[11-template-rendering] Server on port ${port}\n`);

    try {
      // ── Block 1: Basic greeting ──────────────────────────────
      console.log('=== Block 1 — Basic Template Rendering ===\n');
      const res1 = await fetch(`${base}/greeting`);
      const html1 = await res1.text();
      console.log('GET /greeting — Status:', res1.status);     // Output: 200
      console.log('Contains name:', html1.includes('Shah Rukh Khan')); // Output: true
      console.log('');

      // ── Block 2: Layout + producer conditional ───────────────
      console.log('=== Block 2 — Layout Pattern (Producer) ===\n');
      const res2 = await fetch(`${base}/home`);
      const html2 = await res2.text();
      console.log('GET /home — Status:', res2.status);
      console.log('Has layout header:', html2.includes('Bollywood Poster Studio')); // Output: true
      console.log('Has producer badge:', html2.includes('Producer Access'));         // Output: true
      console.log('');

      // ── Block 2: Regular user (no badge, "no films" message) ─
      console.log('=== Block 2 — Conditional (Regular User) ===\n');
      const res3 = await fetch(`${base}/home-regular`);
      const html3 = await res3.text();
      console.log('Has producer badge:', html3.includes('Producer Access')); // Output: false
      console.log('Has "no films":', html3.includes('No films assigned'));   // Output: true
      console.log('');

      // ── Block 2: List rendering ──────────────────────────────
      console.log('=== Block 2 — List Rendering ===\n');
      const res4 = await fetch(`${base}/films`);
      const html4 = await res4.text();
      console.log('Contains Pathaan:', html4.includes('Pathaan')); // Output: true
      console.log('Contains budget:', html4.includes('550 Cr'));   // Output: true

    } catch (err) {
      console.error('Test error:', err.message);
    } finally {
      server.close(() => {
        cleanupTemplateFiles();
        console.log('\n── Server closed, temp files cleaned up ──');

        // ── KEY TAKEAWAYS ─────────────────────────────────────
        // 1. app.engine(ext, fn) registers a template processor.
        //    The fn signature is (filePath, options, callback).
        // 2. app.set('view engine', ext) sets the default extension.
        // 3. app.set('views', dir) points to the template folder.
        // 4. res.render(view, data) finds, processes, and sends HTML.
        // 5. Layouts = render inner content, inject into outer template.
        // 6. Building a custom engine demystifies EJS/Pug/Handlebars.
      });
    }
  });
}

runTests();
