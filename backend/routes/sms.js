require('dotenv').config();
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Africa's Talking initialisation ───────────────────────────────────────────

const AfricasTalking = require('africastalking');

const atUsername = process.env.AT_USERNAME || 'sandbox';
const atApiKey   = process.env.AT_API_KEY  || '';
const atSenderId = process.env.AT_SENDER_ID || undefined;

let smsService;

try {
  const at = AfricasTalking({
    username: atUsername,
    apiKey:   atApiKey,
  });
  smsService = at.SMS;
} catch (initErr) {
  console.error('Failed to initialize Africa\'s Talking SDK:', initErr.message);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Replace {name}, {phone}, {company}, {email} placeholders in a message string
 * with values from the given contact object.
 */
function personalizeMessage(template, contact) {
  return template
    .replace(/\{name\}/gi,    contact.name    || '')
    .replace(/\{phone\}/gi,   contact.phone   || '')
    .replace(/\{company\}/gi, contact.company || '')
    .replace(/\{email\}/gi,   contact.email   || '');
}

/**
 * Send a single SMS via Africa's Talking.
 * Returns { success: true, recipient } or { success: false, recipient, error }
 */
async function sendSingleSms(to, message) {
  const sendOptions = {
    to:      [to],
    message,
  };
  if (atSenderId) {
    sendOptions.from = atSenderId;
  }

  try {
    const response = await smsService.send(sendOptions);
    const recipient = response.SMSMessageData &&
                      response.SMSMessageData.Recipients &&
                      response.SMSMessageData.Recipients[0];

    if (recipient && recipient.status === 'Success') {
      return { success: true, recipient: to };
    }

    // AT returned a non-success status for this number
    const errMsg = recipient ? `${recipient.status}: ${recipient.statusCode}` : 'Unknown AT error';
    return { success: false, recipient: to, error: errMsg };
  } catch (err) {
    return { success: false, recipient: to, error: err.message };
  }
}

/**
 * Fetch contacts for the given category_ids array.
 * An empty array means "all contacts".
 */
function fetchContacts(categoryIds) {
  if (!categoryIds || categoryIds.length === 0) {
    return db.prepare('SELECT * FROM contacts ORDER BY id ASC').all();
  }

  // Build a parameterized IN clause
  const placeholders = categoryIds.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM contacts WHERE category_id IN (${placeholders}) ORDER BY id ASC`
  ).all(...categoryIds);
}

// ── POST /api/sms/send ────────────────────────────────────────────────────────
// Body:
//   message      (string, required unless template_id is provided)
//   category_ids (array of integers, optional — empty/omitted = all contacts)
//   template_id  (integer, optional — overrides message if provided)
router.post('/send', async (req, res) => {
  if (!smsService) {
    return res.status(503).json({
      error: 'Africa\'s Talking SMS service is not available. Check AT_API_KEY configuration.',
    });
  }

  try {
    let { message, category_ids, template_id } = req.body;

    // ── Resolve message ───────────────────────────────────────────────────────
    if (template_id != null) {
      const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id);
      if (!tmpl) {
        return res.status(404).json({ error: `Template with id ${template_id} not found` });
      }
      message = tmpl.content;
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message or a valid template_id is required' });
    }
    message = message.trim();

    // ── Resolve category_ids ──────────────────────────────────────────────────
    if (!Array.isArray(category_ids)) {
      category_ids = [];
    }
    const resolvedCategoryIds = category_ids
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0);

    // Validate each supplied category id exists
    if (resolvedCategoryIds.length > 0) {
      for (const catId of resolvedCategoryIds) {
        const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(catId);
        if (!cat) {
          return res.status(400).json({ error: `Category with id ${catId} does not exist` });
        }
      }
    }

    // ── Fetch recipients ──────────────────────────────────────────────────────
    const contacts = fetchContacts(resolvedCategoryIds);

    if (contacts.length === 0) {
      return res.status(400).json({
        error: 'No contacts found for the specified categories',
      });
    }

    // ── Send messages ─────────────────────────────────────────────────────────
    console.log(`Sending SMS to ${contacts.length} recipient(s)…`);

    const sendPromises = contacts.map((contact) => {
      const personalizedMsg = personalizeMessage(message, contact);
      return sendSingleSms(contact.phone, personalizedMsg);
    });

    const sendResults = await Promise.allSettled(sendPromises);

    let successful = 0;
    let failed     = 0;
    const failedRecipients = [];

    sendResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        const detail = result.status === 'fulfilled'
          ? result.value
          : { recipient: 'unknown', error: result.reason?.message || 'Promise rejected' };
        failedRecipients.push(detail);
      }
    });

    // ── Determine overall status ──────────────────────────────────────────────
    let status;
    if (failed === 0) {
      status = 'success';
    } else if (successful === 0) {
      status = 'failed';
    } else {
      status = 'partial';
    }

    // ── Log to sms_logs ───────────────────────────────────────────────────────
    const logResult = db.prepare(`
      INSERT INTO sms_logs (message, category_ids, recipient_count, successful, failed, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      message,
      JSON.stringify(resolvedCategoryIds),
      contacts.length,
      successful,
      failed,
      status
    );

    const logEntry = db.prepare('SELECT * FROM sms_logs WHERE id = ?').get(logResult.lastInsertRowid);

    res.json({
      message:          'SMS send operation complete',
      log:              logEntry,
      failed_recipients: failedRecipients,
    });
  } catch (err) {
    console.error('POST /api/sms/send error:', err);
    res.status(500).json({ error: 'Failed to send SMS', details: err.message });
  }
});

// ── GET /api/sms/logs ─────────────────────────────────────────────────────────
// Returns paginated SMS send history.
// Query params:
//   page     (default 1)
//   limit    (default 20, max 100)
router.get('/logs', (req, res) => {
  try {
    let page  = parseInt(req.query.page,  10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;

    if (page  < 1)   page  = 1;
    if (limit < 1)   limit = 1;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) AS count FROM sms_logs').get().count;
    const logs  = db.prepare(`
      SELECT * FROM sms_logs ORDER BY sent_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);

    // Parse stored JSON category_ids back into arrays
    const parsedLogs = logs.map((log) => {
      let parsedCategoryIds = [];
      try {
        parsedCategoryIds = JSON.parse(log.category_ids || '[]');
      } catch (_) {
        // Leave as empty array if malformed
      }
      return { ...log, category_ids: parsedCategoryIds };
    });

    res.json({
      data:        parsedLogs,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/sms/logs error:', err);
    res.status(500).json({ error: 'Failed to fetch SMS logs', details: err.message });
  }
});

module.exports = router;
