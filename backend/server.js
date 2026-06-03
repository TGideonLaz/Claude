require('dotenv').config();

// Initialize the database before anything else
require('./db');

const express = require('express');
const cors = require('cors');

const categoriesRouter = require('./routes/categories');
const contactsRouter  = require('./routes/contacts');
const templatesRouter = require('./routes/templates');
const smsRouter       = require('./routes/sms');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/categories', categoriesRouter);
app.use('/api/contacts',   contactsRouter);
app.use('/api/templates',  templatesRouter);
app.use('/api/sms',        smsRouter);

// ── Dashboard stats ───────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', (_req, res) => {
  try {
    const db = require('./db');
    const totalContacts  = db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n;
    const totalCategories = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
    const totalTemplates = db.prepare('SELECT COUNT(*) AS n FROM templates').get().n;
    const smsSentToday   = db.prepare(
      "SELECT COUNT(*) AS n FROM sms_logs WHERE date(sent_at) = date('now')"
    ).get().n;
    const recentLogs = db.prepare(
      'SELECT * FROM sms_logs ORDER BY sent_at DESC LIMIT 5'
    ).all().map(log => ({
      ...log,
      category_ids: (() => { try { return JSON.parse(log.category_ids || '[]'); } catch { return []; } })(),
    }));
    res.json({ totalContacts, totalCategories, totalTemplates, smsSentToday, recentLogs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Africa's Talking username: ${process.env.AT_USERNAME || 'sandbox'}`);
});

module.exports = app;
