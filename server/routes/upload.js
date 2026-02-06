/**
 * @file File upload REST routes for photos and voice notes.
 *
 * Each route uses the Multer middleware configured in middleware/upload.js
 * to handle multipart form data.  Files are written to disk and the
 * resulting URL is returned to the client.
 *
 * Routes:
 *   POST /api/upload/photo         -- Upload a photo (for photo exchange).
 *   POST /api/upload/profile-photo -- Upload and set the user's profile photo.
 *   POST /api/upload/voice         -- Upload a voice note recording.
 *
 * @module server/routes/upload
 */

const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');
const { uploadPhoto, uploadVoice } = require('../middleware/upload');

const router = express.Router();

/**
 * POST /photo
 *
 * Uploads a single photo file (field name "photo").  Returns the
 * server-relative URL that can be used in photo exchanges.
 * Does NOT update the user's profile photo.
 *
 * @returns {{ url: string }} The URL of the uploaded photo.
 */
router.post('/photo', requireAuth, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`;
  res.json({ url: photoUrl });
});

/**
 * POST /profile-photo
 *
 * Uploads a single photo and additionally persists the URL as the
 * authenticated user's profile picture (`users.photo_url`).
 *
 * @returns {{ url: string }} The URL of the uploaded profile photo.
 */
router.post('/profile-photo', requireAuth, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`;
  const db = getDb();
  // Persist the new photo URL on the user record so it appears
  // in profiles, leaderboards, and match screens.
  db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photoUrl, req.userId);
  res.json({ url: photoUrl });
});

/**
 * POST /voice
 *
 * Uploads a single voice-note file (field name "voice").
 * The client typically records audio via MediaRecorder and sends the
 * resulting Blob here before emitting a SEND_VOICE_NOTE socket event
 * with the returned URL.
 *
 * @returns {{ url: string }} The URL of the uploaded voice note.
 */
router.post('/voice', requireAuth, uploadVoice.single('voice'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No voice file uploaded' });
  }
  const voiceUrl = `/uploads/voice/${req.file.filename}`;
  res.json({ url: voiceUrl });
});

module.exports = router;
