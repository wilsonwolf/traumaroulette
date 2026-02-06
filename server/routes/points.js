const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT total_points FROM users WHERE id = ?').get(req.userId);
  const log = db.prepare('SELECT * FROM points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.userId);
  res.json({ total: user.total_points, log });
});

module.exports = router;
