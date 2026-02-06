const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/init');
const { createSession, deleteSession, requireAuth } = require('../middleware/session');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name } = req.body;
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: 'Username, password, and display name are required' });
    }
    if (username.length < 3 || password.length < 4) {
      return res.status(400).json({ error: 'Username must be 3+ chars, password 4+ chars' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
    ).run(username, password_hash, display_name);

    const token = createSession(result.lastInsertRowid);
    const user = db.prepare('SELECT id, username, display_name, onboarding_complete, total_points FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = createSession(user.id);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  deleteSession(token);
  res.json({ ok: true });
});

module.exports = router;
