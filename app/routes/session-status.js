// app/routes/session-status.js
// Coach-scoped read: returns existing capture data for a session
// so the form can hydrate state and show which students already have data.
// Strips narrative columns (coaches shouldn't see those).
//
// IMPORTANT: Match the require() path below to your existing pattern.
// Open routes/capture.js and copy the exact line that imports session/auth middleware.
// It will look like one of:
//   const { requireRole } = require('../auth/session');
//   const { auth, role }  = require('../auth/session');
//   const requireAuth     = require('../auth/session');
// Use whichever YOUR codebase has.

const express = require('express');
const router  = express.Router();
const { requireRole } = require('../auth/session');   // ← match YOUR capture.js import
const hq = require('../lib/hq');

// GET /api/session-status?session_id=GNPS-M1-JNR-22JUN26
router.get('/', requireRole('coach'), async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ ok: false, error: 'session_id required' });

  try {
    const data = await hq.getRows({ session_id });
    // Strip narrative columns — coaches don't need them
    const rows = (data.rows || []).map(r => {
      const { narrative_text, narrative_attribution, ...rest } = r;
      return rest;
    });
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('session-status error:', err.message);
    res.status(502).json({ ok: false, error: 'Could not reach HQ' });
  }
});

module.exports = router;
