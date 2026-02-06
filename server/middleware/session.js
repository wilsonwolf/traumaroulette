/**
 * @file In-memory session management for both HTTP (Express) and
 * WebSocket (Socket.IO) transports.
 *
 * Sessions are stored as a simple Map of UUID tokens to user IDs.
 * Because the store lives in process memory, all sessions are lost
 * when the server restarts.  This is intentional for the current
 * development / single-instance deployment model.
 *
 * Exports:
 *   - Low-level helpers: createSession, getSession, deleteSession
 *   - Express middleware: sessionMiddleware (optional auth extraction),
 *     requireAuth (mandatory auth gate)
 *   - Socket.IO middleware: socketSessionMiddleware (authenticates on
 *     handshake)
 *
 * @module server/middleware/session
 */

/**
 * In-memory session store.
 * Keys are UUID v4 tokens; values are numeric user IDs.
 * @type {Map<string, number>}
 */
const sessions = new Map();

/**
 * Creates a new session for the given user.
 *
 * Generates a random UUID v4 token, stores the mapping, and returns
 * the token to the caller (which should send it back to the client).
 *
 * @param {number} userId - The database ID of the authenticated user.
 * @returns {string} A UUID v4 session token.
 */
function createSession(userId) {
  const token = require('uuid').v4();
  sessions.set(token, userId);
  return token;
}

/**
 * Looks up the user ID associated with a session token.
 *
 * @param {string} token - The session token to look up.
 * @returns {number|null} The user ID, or null if the token is invalid / expired.
 */
function getSession(token) {
  return sessions.get(token) || null;
}

/**
 * Destroys a session by removing the token from the store.
 *
 * @param {string} token - The session token to invalidate.
 */
function deleteSession(token) {
  sessions.delete(token);
}

/**
 * Express middleware that **optionally** extracts authentication info.
 *
 * If the request carries a valid `Authorization: Bearer <token>` header,
 * `req.userId` is set to the corresponding user ID.  If not, the
 * request continues without authentication (useful for public routes
 * or routes where auth is checked deeper in the handler chain).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
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

/**
 * Express middleware that **requires** authentication.
 *
 * Must be placed after {@link sessionMiddleware} in the middleware
 * chain.  Returns 401 if `req.userId` was not set.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

/**
 * Socket.IO middleware that authenticates the WebSocket handshake.
 *
 * Expects the client to pass a session token in `socket.handshake.auth.token`.
 * On success, attaches `socket.userId` so all subsequent event handlers
 * can identify the connected user.  On failure, rejects the connection.
 *
 * @param {import('socket.io').Socket} socket - The connecting socket.
 * @param {Function} next - Callback; pass an Error to reject the connection.
 */
function socketSessionMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('No auth token'));
  }
  const userId = getSession(token);
  if (!userId) {
    return next(new Error('Invalid session'));
  }
  // Attach the user ID to the socket instance so event handlers can use it.
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
