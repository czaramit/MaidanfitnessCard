/**
 * Maidan Play — Fitness Card Web App
 * Express entry point
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { authenticate, requireRole } = require('./auth/session');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.text({ limit: '2mb' }));
app.use(cookieParser());

// ── Health check (no auth) ──────────────────────────────────────
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Auth routes (no auth middleware) ────────────────────────────
app.use('/api', require('./routes/login'));

// ── Protected routes ────────────────────────────────────────────
app.use('/api', authenticate, require('./routes/capture'));
app.use('/api', authenticate, require('./routes/data'));
app.use('/api', authenticate, require('./routes/narrative'));
app.use('/api', authenticate, require('./routes/generate'));

// ── Page routes (serve HTML with role gating) ───────────────────
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/capture', authenticate, requireRole('coach'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/capture.html'));
});

app.get('/admin', authenticate, requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// ── Static assets ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Root redirect ───────────────────────────────────────────────
app.get('/', (req, res) => {
  // If authenticated, go to the right page; otherwise login
  try {
    const jwt = require('jsonwebtoken');
    const token = req.cookies && req.cookies.session;
    if (token) {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'dev-secret');
      return res.redirect(decoded.role === 'admin' ? '/admin' : '/capture');
    }
  } catch (_) { /* not logged in */ }
  res.redirect('/login');
});

// ── Start ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Maidan app listening on :${PORT}`));

module.exports = app;
