const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/templates ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT * FROM templates ORDER BY name ASC
    `).all();
    res.json(templates);
  } catch (err) {
    console.error('GET /api/templates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates', details: err.message });
  }
});

// ── POST /api/templates ───────────────────────────────────────────────────────
// Body: { name, content }
router.post('/', (req, res) => {
  try {
    const { name, content } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Template name is required' });
    }
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const result = db.prepare(`
      INSERT INTO templates (name, content) VALUES (?, ?)
    `).run(name.trim(), content.trim());

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(template);
  } catch (err) {
    console.error('POST /api/templates error:', err);
    res.status(500).json({ error: 'Failed to create template', details: err.message });
  }
});

// ── PUT /api/templates/:id ────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, content } = req.body;

    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'Template name cannot be empty' });
    }
    if (content !== undefined && (typeof content !== 'string' || content.trim() === '')) {
      return res.status(400).json({ error: 'Template content cannot be empty' });
    }

    db.prepare(`
      UPDATE templates SET name = ?, content = ? WHERE id = ?
    `).run(
      name    !== undefined ? name.trim()    : existing.name,
      content !== undefined ? content.trim() : existing.content,
      id
    );

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/templates/:id error:', err);
    res.status(500).json({ error: 'Failed to update template', details: err.message });
  }
});

// ── DELETE /api/templates/:id ─────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    res.json({ message: 'Template deleted successfully', id: Number(id) });
  } catch (err) {
    console.error('DELETE /api/templates/:id error:', err);
    res.status(500).json({ error: 'Failed to delete template', details: err.message });
  }
});

module.exports = router;
