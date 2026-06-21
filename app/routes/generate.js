const router = require('express').Router();
const { requireRole } = require('../auth/session');
const { dispatchWorkflow, getRunStatus } = require('../lib/gh');

// POST /api/generate — dispatch PDF generation
router.post('/generate', requireRole('admin'), async (req, res) => {
  try {
    const { session_id, student_ids } = req.body || {};
    if (!session_id) return res.status(400).json({ ok: false, error: 'session_id required' });

    const result = await dispatchWorkflow(session_id, student_ids);
    res.json(result);
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(502).json({ ok: false, error: 'Could not dispatch generation — check GitHub token' });
  }
});

// GET /api/generate/status?run_id= — poll workflow status
router.get('/generate/status', requireRole('admin'), async (req, res) => {
  try {
    const { run_id } = req.query;
    if (!run_id) return res.status(400).json({ ok: false, error: 'run_id required' });

    const result = await getRunStatus(run_id);
    res.json(result);
  } catch (err) {
    console.error('Status poll error:', err.message);
    res.status(502).json({ ok: false, error: 'Could not check run status' });
  }
});

module.exports = router;
