const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getUser } = require('../auth/users');
const { issueToken, setCookie, clearCookie, authenticate } = require('../auth/session');

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Missing credentials' });

  const user = getUser(username);
  if (!user || !user.hash) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.hash);
  if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

  const token = issueToken(user);
  setCookie(res, token);
  res.json({ ok: true, role: user.role, displayName: user.displayName });
});

// POST /api/logout
router.post('/logout', (_req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

// GET /api/me — returns current session info
router.get('/me', authenticate, (req, res) => {
  res.json({ ok: true, user: { username: req.user.username, displayName: req.user.displayName, role: req.user.role } });
});

module.exports = router;
