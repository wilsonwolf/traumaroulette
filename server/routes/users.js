/**
 * @file User profile and onboarding REST routes.
 *
 * Handles profile updates, trauma submission (with generated comedic
 * response), onboarding completion, leaderboard retrieval, and public
 * user profile lookup.
 *
 * All routes require authentication (enforced by requireAuth).
 *
 * Routes:
 *   PUT  /api/users/profile            -- Partial update of profile fields.
 *   POST /api/users/trauma             -- Submit childhood trauma text.
 *   POST /api/users/complete-onboarding -- Mark onboarding as finished.
 *   GET  /api/users/leaderboard        -- Top 20 users by total_points.
 *   GET  /api/users/:id                -- Public profile of a specific user.
 *
 * @module server/routes/users
 */

const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');
const { getTraumaResponse } = require('../services/trauma');

const router = express.Router();

/**
 * PUT /profile
 *
 * Partially updates the authenticated user's profile.  Only the
 * fields included in the request body are modified; all others
 * remain unchanged.
 *
 * @body {string}  [bio]      - Short bio (max 200 chars).
 * @body {string}  [location] - User's location.
 * @body {string}  [gender]   - User's gender.
 * @body {number}  [age]      - User's age (must be 21-50).
 * @returns {{ user: Object }} The updated user profile.
 */
router.put('/profile', requireAuth, (req, res) => {
  const db = getDb();
  const { bio, location, gender, age } = req.body;

  if (age !== undefined && (age < 21 || age > 50)) {
    return res.status(400).json({ error: 'Age must be between 21 and 50' });
  }
  if (bio !== undefined && bio.length > 200) {
    return res.status(400).json({ error: 'Bio must be 200 characters or less' });
  }

  // Dynamically build the SET clause so only supplied fields are updated.
  // This avoids accidentally nullifying fields the user did not intend to change.
  const fields = [];
  const values = [];
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (location !== undefined) { fields.push('location = ?'); values.push(location); }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }
  if (age !== undefined) { fields.push('age = ?'); values.push(age); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // The user ID is appended last and used in the WHERE clause.
  values.push(req.userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

/**
 * POST /trauma
 *
 * Accepts the user's childhood trauma description, generates a humorous
 * therapist-style response via the trauma service, and persists both the
 * input and the generated response on the user record.
 *
 * @body {string} trauma - Free-text trauma description.
 * @returns {{ response: string }} The generated therapist response.
 */
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

/**
 * POST /complete-onboarding
 *
 * Marks the authenticated user's onboarding as complete so they can
 * access the main application features (matchmaking, chat, etc.).
 *
 * @returns {{ user: Object }} The updated user profile with onboarding_complete = 1.
 */
router.post('/complete-onboarding', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET onboarding_complete = 1 WHERE id = ?').run(req.userId);
  const user = db.prepare('SELECT id, username, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

/**
 * GET /leaderboard
 *
 * Returns the top 20 users ranked by total_points.
 * Only users who have completed onboarding are included.
 *
 * @returns {{ users: Object[] }} Array of user summaries (id, display_name, photo_url, total_points).
 */
router.get('/leaderboard', requireAuth, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, display_name, photo_url, total_points FROM users WHERE onboarding_complete = 1 ORDER BY total_points DESC LIMIT 20').all();
  res.json({ users });
});

/**
 * GET /:id
 *
 * Returns the public profile of a specific user by database ID.
 * Exposes a limited set of fields (no username, password_hash, trauma, etc.).
 *
 * @param {string} id - The user's database ID (route parameter).
 * @returns {{ user: Object }} Public profile fields.
 */
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, display_name, photo_url, bio, location, gender, age, total_points FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
