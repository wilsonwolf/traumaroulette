/**
 * @file Application entry point for the TraumaChat server.
 *
 * Bootstraps the Express HTTP server, configures middleware (CORS, JSON
 * body parsing, static file serving), mounts all REST API route groups
 * under /api/*, initialises the Socket.IO real-time layer, and starts
 * listening on the configured port.
 *
 * Execution order:
 *   1. Create Express app and wrap it in an HTTP server.
 *   2. Attach Socket.IO to the HTTP server.
 *   3. Eagerly initialise the SQLite database (creates tables if needed).
 *   4. Register Express middleware and REST routes.
 *   5. Register Socket.IO authentication middleware and event handlers.
 *   6. Start listening for connections.
 *
 * @module server/index
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { getDb } = require('./db/init');
const { sessionMiddleware, socketSessionMiddleware } = require('./middleware/session');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const conversationRoutes = require('./routes/conversations');
const pointsRoutes = require('./routes/points');
const setupSocketHandlers = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

// Socket.IO is attached to the same HTTP server so that WebSocket upgrade
// requests are handled transparently alongside normal HTTP traffic.
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

// Eagerly open (and create if necessary) the SQLite database so that
// schema errors surface immediately at startup rather than on the first request.
getDb();

// --- Express Middleware ---
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
// Serve uploaded photos and voice notes as static assets.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- REST API Routes ---
// Each route group gets the sessionMiddleware which extracts (but does not
// require) the bearer token.  Individual routes use requireAuth where needed.
app.use('/api/auth', sessionMiddleware, authRoutes);
app.use('/api/users', sessionMiddleware, userRoutes);
app.use('/api/upload', sessionMiddleware, uploadRoutes);
app.use('/api/conversations', sessionMiddleware, conversationRoutes);
app.use('/api/points', sessionMiddleware, pointsRoutes);

// --- Socket.IO ---
// Authenticate every socket connection before allowing event handlers to fire.
io.use(socketSessionMiddleware);
setupSocketHandlers(io);

/** @type {number} Port the server will listen on (default 3001). */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TraumaChat server running on port ${PORT}`);
});
