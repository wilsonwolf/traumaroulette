/**
 * @file Conversation history REST routes.
 *
 * Provides read-only access to a user's past and current conversations,
 * including partner metadata and full message history.
 *
 * Routes:
 *   GET /api/conversations      -- List the authenticated user's conversations.
 *   GET /api/conversations/:id  -- Get a single conversation with messages.
 *
 * @module server/routes/conversations
 */

const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');

const router = express.Router();

/**
 * GET /
 *
 * Returns the 50 most recent conversations for the authenticated user,
 * ordered newest-first.  Each row includes computed partner metadata
 * (name, photo, ID) derived via CASE expressions so the client always
 * sees the "other" user's info regardless of whether the authenticated
 * user is user1 or user2 in the conversations table.
 *
 * @returns {{ conversations: Object[] }} Array of conversation rows with partner info.
 */
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  // The CASE expressions resolve the "other" user's details.
  // req.userId is bound five times because it appears in three CASE
  // conditions and the WHERE clause (which checks both user columns).
  const conversations = db.prepare(`
    SELECT c.*,
      CASE WHEN c.user1_id = ? THEN u2.display_name ELSE u1.display_name END as partner_name,
      CASE WHEN c.user1_id = ? THEN u2.photo_url ELSE u1.photo_url END as partner_photo,
      CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as partner_id
    FROM conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all(req.userId, req.userId, req.userId, req.userId, req.userId);
  res.json({ conversations });
});

/**
 * GET /:id
 *
 * Returns a single conversation and its full message history.
 * The query enforces that the authenticated user is a participant
 * (either user1 or user2) to prevent unauthorized access.
 *
 * @param {string} id - Conversation database ID (route parameter).
 * @returns {{ conversation: Object, messages: Object[] }}
 */
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  // Ensure the requesting user is a participant in this conversation.
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.userId, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conv.id);
  res.json({ conversation: conv, messages });
});

module.exports = router;
