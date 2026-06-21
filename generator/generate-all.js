#!/usr/bin/env node
/**
 * Maidan Play — Batch card generator
 *   node generate-all.js <json-dir> [--out <pdf-dir>] [--concurrency 2]
 *
 * Example:
 *   node generate-all.js sessions/2026Q3_M1/ --out out/2026Q3_M1/ --concurrency 2
 *
 * - Picks up every *.json file in the given directory
 * - Auto-selects template by band_label
 * - Runs N cards in parallel (default 2 — each Chromium instance uses ~200 MB RAM)
 * - Prints a summary table on completion
 * - Skips files that already have a matching PDF in the output dir (re-run safe)
 *
 * Progress: ticks as each card finishes — useful for batches of 20–100.
 */

const fs   = require('fs');
const path = require('path');
const { generateCard } = require('./generate-card');

// ── args ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const jsonDir  = args[0];
if (!jsonDir) { console.error('usage: node generate-all.js <json-dir> [--out <dir>] [--concurrency N]'); process.exit(1); }

const outDir   = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i+1] : 'out'; })();
const concurrency = (() => { const i = args.indexOf('--concurrency'); return i >= 0 ? parseInt(args[i+1], 10) : 2; })();

// ── collect files ────────────────────────────────────────────────────────────
const files = fs.readdirSync(jsonDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(jsonDir, f));

if (files.length === 0) { console.error('No JSON files found in', jsonDir); process.exit(1); }
console.log(`\nMaidan Play — Batch generator`);
console.log(`  Input : ${jsonDir}  (${files.length} cards)`);
console.log(`  Output: ${outDir}`);
console.log(`  Concurrency: ${concurrency}\n`);

// ── skip already-generated ───────────────────────────────────────────────────
function alreadyDone(dataPath) {
  const record = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const safe = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '_');
  const base = ['Maidan', safe(record.student && record.student.first_name),
    safe(record.student && record.student.last_name), safe(record.band_label),
    safe(record.cycle && record.cycle.cycle_id), safe(record.cycle && record.cycle.point)
  ].filter(Boolean).join('_');
  return fs.existsSync(path.join(outDir, base + '.pdf'));
}
const todo = files.filter(f => !alreadyDone(f));
const skipped = files.length - todo.length;
if (skipped > 0) console.log(`  Skipping ${skipped} already-generated card(s).\n`);
if (todo.length === 0) { console.log('All cards already generated.'); process.exit(0); }

// ── pool runner ───────────────────────────────────────────────────────────────
let done = 0;
const results = [];
const start = Date.now();

async function run() {
  const queue = [...todo];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      const t0 = Date.now();
      try {
        const { pdfPath } = await generateCard(file, outDir);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        done++;
        results.push({ file: path.basename(file), status: 'ok', elapsed });
        process.stdout.write(`  [${done}/${todo.length}] ✓  ${path.basename(pdfPath)}  (${elapsed}s)\n`);
      } catch (err) {
        done++;
        results.push({ file: path.basename(file), status: 'error', error: err.message });
        process.stdout.write(`  [${done}/${todo.length}] ✗  ${path.basename(file)}  ERROR: ${err.message}\n`);
      }
    }
  });
  await Promise.all(workers);
}

run().then(() => {
  const totalSec = ((Date.now() - start) / 1000).toFixed(1);
  const ok = results.filter(r => r.status === 'ok').length;
  const errors = results.filter(r => r.status === 'error');
  console.log(`\n── Summary ────────────────────────────────`);
  console.log(`  Generated : ${ok} card(s)  |  Errors: ${errors.length}  |  Total: ${totalSec}s`);
  if (errors.length) {
    console.log('\n  Failed:');
    errors.forEach(e => console.log(`    ${e.file}: ${e.error}`));
    process.exit(1);
  }
}).catch(e => { console.error(e); process.exit(1); });
