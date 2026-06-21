const router = require('express').Router();
const { requireRole } = require('../auth/session');
const { getRows } = require('../lib/hq');

// GET /api/data — admin reads filtered rows
router.get('/data', requireRole('admin'), async (req, res) => {
  try {
    const { session_id, band, coach, date } = req.query;
    const result = await getRows({ session_id, band, coach, date });
    res.json(result);
  } catch (err) {
    console.error('Data fetch error:', err.message);
    res.status(502).json({ ok: false, error: 'Could not fetch data from HQ' });
  }
});

module.exports = router;
