/**
 * @file Authentication REST routes: registration, login, session
 * introspection ("me"), and logout.
 *
 * All passwords are hashed with bcrypt (cost factor 10).
 * Sessions are managed via bearer tokens stored in-memory
 * (see middleware/session.js).
 *
 * Routes:
 *   POST /api/auth/register  -- Create a new account.
 *   POST /api/auth/login     -- Authenticate with username + password.
 *   GET  /api/auth/me        -- Return the currently authenticated user.
 *   POST /api/auth/logout    -- Destroy the current session.
 *
 * @module server/routes/auth
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/init');
const { createSession, deleteSession, requireAuth } = require('../middleware/session');

const router = express.Router();

/**
 * POST /register
 *
 * Creates a new user account, hashes the password, starts a session,
 * and returns the session token along with a safe subset of user fields.
 *
 * @body {string} username     - Unique username (min 3 characters).
 * @body {string} password     - Plain-text password (min 4 characters).
 * @body {string} display_name - Name shown to other users.
 * @returns {{ token: string, user: Object }} Session token and user profile.
 */
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
    // Guard against duplicate usernames (UNIQUE constraint would also catch this,
    // but an explicit check gives a friendlier error message).
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
    ).run(username, password_hash, display_name);

    // Immediately create a session so the user is logged in right after registering.
    const token = createSession(result.lastInsertRowid);
    const user = db.prepare('SELECT id, username, display_name, onboarding_complete, total_points FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /login
 *
 * Authenticates a user by comparing the supplied password against
 * the stored bcrypt hash.  On success, creates a new session and
 * returns the token plus the full user profile (minus password_hash).
 *
 * @body {string} username
 * @body {string} password
 * @returns {{ token: string, user: Object }}
 */
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
    // Strip the password_hash before sending the user object to the client.
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /me
 *
 * Returns the profile of the currently authenticated user.
 * Requires a valid session (enforced by requireAuth).
 *
 * @returns {{ user: Object }} The authenticated user's profile.
 */
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

/**
 * POST /logout
 *
 * Invalidates the current session token. Requires authentication.
 *
 * @returns {{ ok: true }}
 */
router.post('/logout', requireAuth, (req, res) => {
  // Extract the bearer token from the Authorization header.
  const token = req.headers.authorization.slice(7);
  deleteSession(token);
  res.json({ ok: true });
});

module.exports = router;
