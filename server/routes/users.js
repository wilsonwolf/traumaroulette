const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');
const { getTraumaResponse } = require('../services/trauma');

const router = express.Router();

router.put('/profile', requireAuth, (req, res) => {
  const db = getDb();
  const { bio, location, gender, age } = req.body;

  if (age !== undefined && (age < 21 || age > 50)) {
    return res.status(400).json({ error: 'Age must be between 21 and 50' });
  }
  if (bio !== undefined && bio.length > 200) {
    return res.status(400).json({ error: 'Bio must be 200 characters or less' });
  }

  const fields = [];
  const values = [];
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (location !== undefined) { fields.push('location = ?'); values.push(location); }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }
  if (age !== undefined) { fields.push('age = ?'); values.push(age); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

router.post('/trauma', requireAuth, (req, res) => {
  const { trauma } = req.body;
  if (!trauma || trauma.trim().length === 0) {
    return res.status(400).json({ error: 'Please describe your trauma' });
  }

  const response = getTraumaResponse(trauma);
  const db = getDb();
  db.prepare('UPDATE users SET childhood_trauma = ?, trauma_response = ? WHERE id = ?')
    .run(trauma, response, req.userId);

  res.json({ response });
});

router.post('/complete-onboarding', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET onboarding_complete = 1 WHERE id = ?').run(req.userId);
  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

router.get('/leaderboard', requireAuth, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, display_name, photo_url, total_points FROM users WHERE onboarding_complete = 1 ORDER BY total_points DESC LIMIT 20').all();
  res.json({ users });
});

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, display_name, photo_url, bio, location, gender, age, total_points FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
