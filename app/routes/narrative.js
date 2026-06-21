const router = require('express').Router();
const { requireRole } = require('../auth/session');
const { updateNarrative } = require('../lib/hq');

// Banned words (all bands)
const BANNED_ALL = ['weak', 'behind', 'average', 'needs', 'should', 'potential', 'elite'];
// Words permitted for Toddler but banned for all other bands
const TODDLER_PERMIT = ['developing', 'growing', 'learning', 'building', 'trying'];

function checkBannedWords(text, bandLabel) {
  const lower = (text || '').toLowerCase();
  const isToddler = (bandLabel || '').toLowerCase().startsWith('toddler');

  for (const w of BANNED_ALL) {
    if (new RegExp('\\b' + w + '\\b', 'i').test(lower)) {
      return w;
    }
  }
  if (!isToddler) {
    for (const w of TODDLER_PERMIT) {
      if (new RegExp('\\b' + w + '\\b', 'i').test(lower)) {
        return w;
      }
    }
  }
  return null;
}

// PATCH /api/narrative — admin edits narrative text
router.patch('/narrative', requireRole('admin'), async (req, res) => {
  try {
    const { student_id, session_id, narrative_text, narrative_attribution, band_label } = req.body || {};
    if (!student_id || !session_id) {
      return res.status(400).json({ ok: false, error: 'student_id and session_id required' });
    }

    // Banned word check
    const banned = checkBannedWords(narrative_text, band_label);
    if (banned) {
      return res.status(422).json({ ok: false, error: `Banned word: "${banned}"`, word: banned });
    }

    const result = await updateNarrative({ student_id, session_id, narrative_text, narrative_attribution });
    res.json(result);
  } catch (err) {
    console.error('Narrative error:', err.message);
    res.status(502).json({ ok: false, error: 'Could not update narrative' });
  }
});

module.exports = router;
