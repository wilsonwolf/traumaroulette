/**
 * @file Multer upload middleware for photo and voice-note file handling.
 *
 * Configures two separate Multer instances:
 *   - `uploadPhoto` -- accepts image files (jpeg, jpg, png, gif, webp)
 *     up to 5 MB, saved to `uploads/photos/` with a UUID filename.
 *   - `uploadVoice` -- accepts audio recordings up to 10 MB, saved to
 *     `uploads/voice/` as `.webm` files with a UUID filename.
 *
 * Both use disk storage (not memory) so large uploads do not consume
 * excessive RAM.
 *
 * @module server/middleware/upload
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/** Root directory for all user-uploaded files. */
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Multer disk storage engine for photo uploads.
 * Files are written to `uploads/photos/` and renamed to a UUID to
 * prevent collisions and avoid exposing original filenames.
 */
const photoStorage = multer.diskStorage({
  destination: path.join(UPLOADS_DIR, 'photos'),
  filename: (req, file, cb) => {
    // Preserve the original extension; default to .jpg if none is present.
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

/**
 * Multer disk storage engine for voice-note uploads.
 * All voice notes are stored as `.webm` (WebM Opus) in `uploads/voice/`.
 */
const voiceStorage = multer.diskStorage({
  destination: path.join(UPLOADS_DIR, 'voice'),
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}.webm`);
  },
});

/**
 * Configured Multer instance for photo uploads.
 * - Max file size: 5 MB
 * - Allowed extensions/MIME types: jpeg, jpg, png, gif, webp
 *
 * @type {import('multer').Multer}
 */
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    // Validate both the file extension and the MIME type to prevent
    // spoofed content-type uploads.
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

/**
 * Configured Multer instance for voice-note uploads.
 * - Max file size: 10 MB
 * - No file-type filter (browser MediaRecorder output is trusted).
 *
 * @type {import('multer').Multer}
 */
const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { uploadPhoto, uploadVoice };
