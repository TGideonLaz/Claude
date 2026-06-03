const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/categories ───────────────────────────────────────────────────────
// List all categories with a count of how many contacts belong to each.
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.created_at,
        COUNT(con.id) AS contact_count
      FROM categories c
      LEFT JOIN contacts con ON con.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();

    res.json(categories);
  } catch (err) {
    console.error('GET /api/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
  }
});

// ── POST /api/categories ──────────────────────────────────────────────────────
// Create a new category. Body: { name, description }
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO categories (name, description)
      VALUES (?, ?)
    `);

    const result = stmt.run(name.trim(), description ? description.trim() : null);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A category with that name already exists' });
    }
    console.error('POST /api/categories error:', err);
    res.status(500).json({ error: 'Failed to create category', details: err.message });
  }
});

// ── PUT /api/categories/:id ───────────────────────────────────────────────────
// Update an existing category. Body: { name, description }
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'Category name cannot be empty' });
    }

    const updatedName        = name        !== undefined ? name.trim()        : existing.name;
    const updatedDescription = description !== undefined ? description.trim() : existing.description;

    db.prepare(`
      UPDATE categories SET name = ?, description = ? WHERE id = ?
    `).run(updatedName, updatedDescription, id);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A category with that name already exists' });
    }
    console.error('PUT /api/categories/:id error:', err);
    res.status(500).json({ error: 'Failed to update category', details: err.message });
  }
});

// ── DELETE /api/categories/:id ────────────────────────────────────────────────
// Delete a category. Contacts in this category become uncategorized (category_id = NULL)
// because of ON DELETE SET NULL on the foreign key.
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    res.json({ message: 'Category deleted successfully', id: Number(id) });
  } catch (err) {
    console.error('DELETE /api/categories/:id error:', err);
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
});

module.exports = router;
