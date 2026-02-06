// In-memory session store: token -> userId
const sessions = new Map();

function createSession(userId) {
  const token = require('uuid').v4();
  sessions.set(token, userId);
  return token;
}

function getSession(token) {
  return sessions.get(token) || null;
}

function deleteSession(token) {
  sessions.delete(token);
}

function sessionMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userId = getSession(token);
    if (userId) {
      req.userId = userId;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function socketSessionMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('No auth token'));
  }
  const userId = getSession(token);
  if (!userId) {
    return next(new Error('Invalid session'));
  }
  socket.userId = userId;
  next();
}

module.exports = {
  sessions,
  createSession,
  getSession,
  deleteSession,
  sessionMiddleware,
  requireAuth,
  socketSessionMiddleware,
};
