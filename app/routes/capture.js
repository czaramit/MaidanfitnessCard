const router = require('express').Router();
const { requireRole } = require('../auth/session');
const { postCapture } = require('../lib/hq');

// POST /api/capture — coach sends wide rows
router.post('/capture', requireRole('coach'), async (req, res) => {
  try {
    // Accept both JSON body and text/plain (CORS-safe from form)
    let rows = req.body;
    if (typeof rows === 'string') {
      try { rows = JSON.parse(rows); } catch (_) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON' });
      }
    }
    if (!Array.isArray(rows)) {
      // Maybe it's { rows: [...] }
      rows = rows.rows || rows;
      if (!Array.isArray(rows)) return res.status(400).json({ ok: false, error: 'Expected array of rows' });
    }

    // Overwrite captured_by from session (authoritative)
    const coachName = req.user.displayName;
    rows = rows.map(r => ({ ...r, captured_by: coachName }));

    const result = await postCapture(rows);
    res.json(result);
  } catch (err) {
    console.error('Capture error:', err.message);
    res.status(502).json({ ok: false, error: 'HQ unreachable — data saved locally, retry later' });
  }
});

module.exports = router;
