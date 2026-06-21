#!/usr/bin/env node
/**
 * Maidan Play — Fitness Card generator
 *   node generate-card.js <data.json> [--out out/]
 *
 * Template is auto-selected from record.band_label:
 *   Toddler            → templates/toddler.hbs.html
 *   Sub Junior, Junior, Senior → templates/standard.hbs.html
 */

const fs   = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer  = require('puppeteer-core');
const QRCode     = require('qrcode');

const CANDIDATES = [
  '/opt/google/chrome/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const chromePath = CANDIDATES.find(p => fs.existsSync(p));
if (!chromePath) throw new Error('No Chromium binary found.');

const TEMPLATES = {
  'Toddler': path.join(__dirname, 'templates/toddler.hbs.html'),
};
const STANDARD_TPL = path.join(__dirname, 'templates/standard.hbs.html');

function pickTemplate(band_label) {
  return TEMPLATES[band_label] || STANDARD_TPL;
}

function fileBase(r) {
  const safe = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '_');
  return ['Maidan', safe(r.student && r.student.first_name),
          safe(r.student && r.student.last_name),
          safe(r.band_label),
          safe(r.cycle && r.cycle.cycle_id),
          safe(r.cycle && r.cycle.point)].filter(Boolean).join('_');
}

async function generateCard(dataPath, outDir) {
  const record = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const tplPath = pickTemplate(record.band_label);
  const tpl = fs.readFileSync(tplPath, 'utf8');

  if (record.qr_target_url) {
    record.qr_data_uri = await QRCode.toDataURL(record.qr_target_url, {
      margin: 0, width: 200,
      color: { dark: '#0E1419', light: '#FFFFFF' },
    });
  }

  const html = Handlebars.compile(tpl)(record);
  fs.mkdirSync(outDir, { recursive: true });

  const base = fileBase(record);
  const debugPath = path.join(outDir, base + '.debug.html');
  fs.writeFileSync(debugPath, html);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: ['networkidle0', 'load'] });
  await page.evaluateHandle('document.fonts.ready');

  const pdfPath = path.join(outDir, base + '.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  return { pdfPath, debugPath, base };
}

// ── CLI entry point ──────────────────────────────────────────────────────────
if (require.main === module) {
const args = process.argv.slice(2);
if (!args[0]) {
  console.error('usage: node generate-card.js <data.json> [--out <dir>]');
  process.exit(1);
}
const outDir = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i+1] : 'out'; })();

generateCard(args[0], outDir)
  .then(({ pdfPath, debugPath }) => {
    console.log('✓ PDF   :', pdfPath);
    console.log('  HTML  :', debugPath);
  })
  .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generateCard };
