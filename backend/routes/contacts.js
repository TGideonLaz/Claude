const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Basic E.164-ish phone normalisation: strip spaces/dashes, ensure it's not empty.
 * Full validation is left to the Africa's Talking API which provides detailed errors.
 */
function normalizePhone(phone) {
  return phone ? phone.replace(/[\s\-().]/g, '') : null;
}

// ── GET /api/contacts ─────────────────────────────────────────────────────────
// List all contacts. Supports ?category_id=X filter (use "null" or "uncategorized"
// to list contacts with no category).
router.get('/', (req, res) => {
  try {
    const { category_id } = req.query;

    let query = `
      SELECT
        con.id,
        con.name,
        con.phone,
        con.email,
        con.company,
        con.category_id,
        con.created_at,
        cat.name AS category_name
      FROM contacts con
      LEFT JOIN categories cat ON cat.id = con.category_id
    `;
    const params = [];

    if (category_id !== undefined) {
      if (category_id === 'null' || category_id === 'uncategorized') {
        query += ' WHERE con.category_id IS NULL';
      } else {
        query += ' WHERE con.category_id = ?';
        params.push(Number(category_id));
      }
    }

    query += ' ORDER BY con.name ASC';

    const contacts = db.prepare(query).all(...params);
    res.json(contacts);
  } catch (err) {
    console.error('GET /api/contacts error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts', details: err.message });
  }
});

// ── POST /api/contacts ────────────────────────────────────────────────────────
// Create a single contact. Body: { name, phone, email, company, category_id }
router.post('/', (req, res) => {
  try {
    const { name, phone, email, company, category_id } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Contact name is required' });
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Contact phone number is required' });
    }

    // Validate category exists if provided
    if (category_id != null) {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
      if (!cat) {
        return res.status(400).json({ error: `Category with id ${category_id} does not exist` });
      }
    }

    const result = db.prepare(`
      INSERT INTO contacts (name, phone, email, company, category_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      normalizedPhone,
      email   ? email.trim()   : null,
      company ? company.trim() : null,
      category_id != null ? Number(category_id) : null
    );

    const contact = db.prepare(`
      SELECT con.*, cat.name AS category_name
      FROM contacts con
      LEFT JOIN categories cat ON cat.id = con.category_id
      WHERE con.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(contact);
  } catch (err) {
    console.error('POST /api/contacts error:', err);
    res.status(500).json({ error: 'Failed to create contact', details: err.message });
  }
});

// ── PUT /api/contacts/:id ─────────────────────────────────────────────────────
// Update a contact.
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, company, category_id } = req.body;

    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'Contact name cannot be empty' });
    }

    // Validate phone if provided
    let updatedPhone = existing.phone;
    if (phone !== undefined) {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return res.status(400).json({ error: 'Phone number cannot be empty' });
      }
      updatedPhone = normalized;
    }

    // Validate category if being changed
    let updatedCategoryId = existing.category_id;
    if (category_id !== undefined) {
      if (category_id === null) {
        updatedCategoryId = null;
      } else {
        const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
        if (!cat) {
          return res.status(400).json({ error: `Category with id ${category_id} does not exist` });
        }
        updatedCategoryId = Number(category_id);
      }
    }

    db.prepare(`
      UPDATE contacts
      SET name = ?, phone = ?, email = ?, company = ?, category_id = ?
      WHERE id = ?
    `).run(
      name    !== undefined ? name.trim()    : existing.name,
      updatedPhone,
      email   !== undefined ? (email   ? email.trim()   : null) : existing.email,
      company !== undefined ? (company ? company.trim() : null) : existing.company,
      updatedCategoryId,
      id
    );

    const updated = db.prepare(`
      SELECT con.*, cat.name AS category_name
      FROM contacts con
      LEFT JOIN categories cat ON cat.id = con.category_id
      WHERE con.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/contacts/:id error:', err);
    res.status(500).json({ error: 'Failed to update contact', details: err.message });
  }
});

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    res.json({ message: 'Contact deleted successfully', id: Number(id) });
  } catch (err) {
    console.error('DELETE /api/contacts/:id error:', err);
    res.status(500).json({ error: 'Failed to delete contact', details: err.message });
  }
});

// ── POST /api/contacts/import ─────────────────────────────────────────────────
// Bulk import an array of contacts.
// Body: Array of { name, phone, email?, company?, category_id? }
// Returns counts of inserted vs skipped (validation failures).
router.post('/import', (req, res) => {
  try {
    const contacts = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of contacts' });
    }

    // Pre-load all category ids for fast validation
    const validCategoryIds = new Set(
      db.prepare('SELECT id FROM categories').all().map(r => r.id)
    );

    const insertStmt = db.prepare(`
      INSERT INTO contacts (name, phone, email, company, category_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    const results = {
      inserted: 0,
      skipped:  0,
      errors:   [],
    };

    // Run all inserts in a single transaction for performance
    const importMany = db.transaction((rows) => {
      rows.forEach((contact, index) => {
        const { name, phone, email, company, category_id } = contact;

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim() === '') {
          results.skipped++;
          results.errors.push({ index, reason: 'Missing or empty name', contact });
          return;
        }

        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          results.skipped++;
          results.errors.push({ index, reason: 'Missing or empty phone', contact });
          return;
        }

        let resolvedCategoryId = null;
        if (category_id != null) {
          if (!validCategoryIds.has(Number(category_id))) {
            results.skipped++;
            results.errors.push({ index, reason: `Category id ${category_id} does not exist`, contact });
            return;
          }
          resolvedCategoryId = Number(category_id);
        }

        try {
          insertStmt.run(
            name.trim(),
            normalizedPhone,
            email   ? email.trim()   : null,
            company ? company.trim() : null,
            resolvedCategoryId
          );
          results.inserted++;
        } catch (insertErr) {
          results.skipped++;
          results.errors.push({ index, reason: insertErr.message, contact });
        }
      });
    });

    importMany(contacts);

    res.status(207).json({
      message:  `Import complete: ${results.inserted} inserted, ${results.skipped} skipped`,
      inserted: results.inserted,
      skipped:  results.skipped,
      errors:   results.errors,
    });
  } catch (err) {
    console.error('POST /api/contacts/import error:', err);
    res.status(500).json({ error: 'Failed to import contacts', details: err.message });
  }
});

module.exports = router;
