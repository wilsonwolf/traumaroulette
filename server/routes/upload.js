const express = require('express');
const { getDb } = require('../db/init');
const { requireAuth } = require('../middleware/session');
const { uploadPhoto, uploadVoice } = require('../middleware/upload');

const router = express.Router();

router.post('/photo', requireAuth, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`;
  res.json({ url: photoUrl });
});

router.post('/profile-photo', requireAuth, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`;
  const db = getDb();
  db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photoUrl, req.userId);
  res.json({ url: photoUrl });
});

router.post('/voice', requireAuth, uploadVoice.single('voice'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No voice file uploaded' });
  }
  const voiceUrl = `/uploads/voice/${req.file.filename}`;
  res.json({ url: voiceUrl });
});

module.exports = router;
