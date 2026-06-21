/**
 * Maidan Play — Apps Script thin client
 * All Sheet I/O goes through here.
 */
const fetch = require('node-fetch');

const URL = () => process.env.HQ_APPSCRIPT_URL;
const TOKEN = () => process.env.HQ_TOKEN;

function checkConfig() {
  if (!URL() || !TOKEN()) throw new Error('HQ_APPSCRIPT_URL and HQ_TOKEN must be set');
}

/** POST capture rows (UPSERT) */
async function postCapture(rows) {
  checkConfig();
  const res = await fetch(URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'capture', token: TOKEN(), rows }),
    redirect: 'follow',
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (_) { return { ok: true, raw: text }; }
}

/** GET filtered rows */
async function getRows({ session_id, band, coach, date } = {}) {
  checkConfig();
  const params = new URLSearchParams({ action: 'rows', token: TOKEN() });
  if (session_id) params.set('session_id', session_id);
  if (band) params.set('band', band);
  if (coach) params.set('coach', coach);
  if (date) params.set('date', date);

  const res = await fetch(`${URL()}?${params}`, { redirect: 'follow' });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (_) { return { ok: false, error: 'Unexpected response', raw: text }; }
}

/** POST narrative update */
async function updateNarrative({ student_id, session_id, narrative_text, narrative_attribution }) {
  checkConfig();
  const res = await fetch(URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'narrative', token: TOKEN(),
      student_id, session_id, narrative_text, narrative_attribution,
    }),
    redirect: 'follow',
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (_) { return { ok: true, raw: text }; }
}

module.exports = { postCapture, getRows, updateNarrative };
