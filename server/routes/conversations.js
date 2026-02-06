const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
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

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)').get(req.params.id, req.userId, req.userId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conv.id);
  res.json({ conversation: conv, messages });
});

module.exports = router;
