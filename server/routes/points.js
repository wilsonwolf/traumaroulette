/**
 * @file Points / gamification REST route.
 *
 * Provides the authenticated user with their current point total
 * and a recent history of point-earning events.
 *
 * Routes:
 *   GET /api/points -- Return total points and the 50 most recent log entries.
 *
 * @module server/routes/points
 */

const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');

const router = express.Router();

/**
 * GET /
 *
 * Returns the authenticated user's total accumulated points and the
 * 50 most recent entries from the points_log table (newest first).
 * Each log entry includes the event_type, points awarded, a human-
 * readable description, and the associated conversation (if any).
 *
 * @returns {{ total: number, log: Object[] }}
 */
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT total_points FROM users WHERE id = ?').get(req.userId);
  const log = db.prepare('SELECT * FROM points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.userId);
  res.json({ total: user.total_points, log });
});

module.exports = router;
