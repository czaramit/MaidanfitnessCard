/**
 * Maidan Play — Fitness Card Capture · HQ Sheets receiver v3
 * -----------------------------------------------------------
 * Extended for the web app:
 *   doPost  action:"capture"   — UPSERT wide rows (multi-coach safe)
 *   doPost  action:"narrative" — update narrative_text for one student-session
 *   doGet   action:"rows"     — return filtered rows as JSON
 *
 * All calls carry a shared `token` checked against SCRIPT_TOKEN.
 *
 * Column order matches CAPTURE_COLS (the capture form's buildWideRows output).
 * Dedup key: student_id + session_id
 */

// ── Token ────────────────────────────────────────────────────────
// Set this in the script properties (File → Project Settings → Script Properties).
// Key: SCRIPT_TOKEN   Value: a long random string matching HQ_TOKEN in the app.
const SCRIPT_TOKEN = PropertiesService.getScriptProperties().getProperty('SCRIPT_TOKEN') || '';

function checkToken_(params) {
  const t = params.token || '';
  if (!SCRIPT_TOKEN || t !== SCRIPT_TOKEN) {
    throw new Error('AUTH_FAILED');
  }
}

// ── Column schema ────────────────────────────────────────────────
const CAPTURE_COLS = [
  'student_id', 'student_name', 'band_label',
  'session_id', 'field_type', 'measurement_point', 'combine_date',
  'exported_at', 'captured_by',
  'height_cm', 'weight_kg',
  'p1_drill_id', 'p1_value', 'p1_status', 'p1_flag',
  'p2_drill_id', 'p2_value', 'p2_status', 'p2_flag',
  'p3_drill_id', 'p3_value', 'p3_status', 'p3_flag',
  'p4_drill_id', 'p4_value', 'p4_status', 'p4_flag',
  'p5_drill_id', 'p5_value', 'p5_status', 'p5_flag',
  'p6_drill_id', 'p6_value', 'p6_status', 'p6_flag',
  'p7_drill_id', 'p7_value', 'p7_status', 'p7_flag',
  'eng_participation_yn', 'eng_participation_bucket',
  'eng_perseverance_yn',  'eng_perseverance_bucket',
  'eng_teamwork_yn',      'eng_teamwork_bucket',
  'narrative_text', 'narrative_attribution',
];

// Columns that are HQ-only — never overwritten by a coach send
const HQ_ONLY = new Set(['narrative_text', 'narrative_attribution']);

function dedupKey_(row) {
  return (row['student_id'] || '') + '||' + (row['session_id'] || '');
}

function colIndex_(col) {
  return CAPTURE_COLS.indexOf(col);
}

// ── doPost ───────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || 'capture';

    checkToken_(payload);

    if (action === 'narrative') {
      return handleNarrative_(payload);
    }

    // Default: capture (UPSERT)
    const rows = payload.rows || payload;
    if (!Array.isArray(rows)) throw new Error('Payload must include a rows array.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = upsertRows_(ss, 'captures', rows, CAPTURE_COLS);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, added: result.added, merged: result.merged }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const status = err.message === 'AUTH_FAILED' ? 403 : 500;
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doGet — return rows as JSON ──────────────────────────────────
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'health';

    if (action === 'health') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, message: 'Maidan capture receiver v3 is live.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    checkToken_(params);

    if (action === 'rows') {
      return handleReadRows_(params);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Read rows with optional filters ──────────────────────────────
function handleReadRows_(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('captures');
  if (!sheet || sheet.getLastRow() < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, CAPTURE_COLS.length).getValues();
  const rows = [];

  const fSession = params.session_id || '';
  const fBand    = params.band || '';
  const fCoach   = params.coach || '';
  const fDate    = params.date || '';

  const iSession  = colIndex_('session_id');
  const iBand     = colIndex_('band_label');
  const iCoach    = colIndex_('captured_by');
  const iDate     = colIndex_('combine_date');

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (fSession && row[iSession] !== fSession) continue;
    if (fBand && String(row[iBand]).indexOf(fBand) === -1) continue;
    if (fCoach && String(row[iCoach]).indexOf(fCoach) === -1) continue;
    if (fDate && String(row[iDate]) !== fDate) continue;

    var obj = {};
    for (var c = 0; c < CAPTURE_COLS.length; c++) {
      obj[CAPTURE_COLS[c]] = row[c] === undefined || row[c] === null ? '' : row[c];
    }
    rows.push(obj);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Narrative update ─────────────────────────────────────────────
function handleNarrative_(payload) {
  var sid  = payload.student_id;
  var sess = payload.session_id;
  if (!sid || !sess) throw new Error('student_id and session_id are required');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('captures');
  if (!sheet) throw new Error('Sheet "captures" not found');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('No data rows');

    var sidCol  = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    var sessCol = sheet.getRange(2, colIndex_('session_id') + 1, lastRow - 1, 1).getValues().flat();

    var rowNum = -1;
    for (var i = 0; i < sidCol.length; i++) {
      if (sidCol[i] === sid && sessCol[i] === sess) { rowNum = i + 2; break; }
    }
    if (rowNum < 0) throw new Error('Row not found for student_id=' + sid + ' session_id=' + sess);

    var narrCol = colIndex_('narrative_text') + 1;
    var attrCol = colIndex_('narrative_attribution') + 1;
    sheet.getRange(rowNum, narrCol).setValue(payload.narrative_text || '');
    sheet.getRange(rowNum, attrCol).setValue(payload.narrative_attribution || '');

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ── UPSERT — multi-coach safe ────────────────────────────────────
// If a row with the same student_id+session_id exists, merge non-destructively:
//   - HQ-only columns (narrative) are never overwritten by captures
//   - captured_by is pipe-concatenated (audit trail of all contributing coaches)
//   - exported_at is always updated
//   - all other columns: fill only if currently blank (non-destructive merge)
function upsertRows_(ss, sheetName, records, columns) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var lastRow = sheet.getLastRow();

    // Build key→rowNumber map
    var keyMap = {};
    if (lastRow > 1) {
      var sidCol  = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      var sessCol = sheet.getRange(2, colIndex_('session_id') + 1, lastRow - 1, 1).getValues().flat();
      for (var i = 0; i < sidCol.length; i++) {
        if (sidCol[i]) keyMap[sidCol[i] + '||' + sessCol[i]] = i + 2;
      }
    }

    var newRows = [];
    var added = 0, merged = 0;

    var capturedByIdx = colIndex_('captured_by');
    var exportedAtIdx = colIndex_('exported_at');

    records.forEach(function(r) {
      if (!r['student_id'] || !r['session_id']) return;
      var key = dedupKey_(r);

      if (keyMap[key]) {
        // MERGE into existing row
        var rowNum = keyMap[key];
        var existing = sheet.getRange(rowNum, 1, 1, columns.length).getValues()[0];

        for (var c = 0; c < columns.length; c++) {
          var col = columns[c];
          var incoming = r[col];
          if (incoming === undefined || incoming === null) incoming = '';
          if (Array.isArray(incoming)) incoming = incoming.join('|');

          if (HQ_ONLY.has(col)) continue;

          if (col === 'captured_by') {
            // Pipe-concatenate coach names (deduped)
            var coaches = String(existing[c] || '').split('|').filter(Boolean);
            var newCoach = String(incoming);
            if (newCoach && coaches.indexOf(newCoach) === -1) {
              coaches.push(newCoach);
              sheet.getRange(rowNum, c + 1).setValue(coaches.join('|'));
            }
          } else if (col === 'exported_at') {
            sheet.getRange(rowNum, c + 1).setValue(incoming || existing[c]);
          } else {
            // Non-destructive: fill only if blank
            if ((existing[c] === '' || existing[c] === null || existing[c] === undefined) && incoming !== '') {
              sheet.getRange(rowNum, c + 1).setValue(incoming);
            }
          }
        }
        merged++;
      } else {
        // NEW row
        keyMap[key] = lastRow + newRows.length + 1;
        newRows.push(columns.map(function(col) {
          var v = r[col];
          if (Array.isArray(v)) return v.join('|');
          return (v === undefined || v === null) ? '' : v;
        }));
        added++;
      }
    });

    if (newRows.length > 0) {
      sheet.getRange(lastRow + 1, 1, newRows.length, columns.length).setValues(newRows);
    }

    return { added: added, merged: merged };
  } finally {
    lock.releaseLock();
  }
}
