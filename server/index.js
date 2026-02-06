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

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

// Initialize DB
getDb();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', sessionMiddleware, authRoutes);
app.use('/api/users', sessionMiddleware, userRoutes);
app.use('/api/upload', sessionMiddleware, uploadRoutes);
app.use('/api/conversations', sessionMiddleware, conversationRoutes);
app.use('/api/points', sessionMiddleware, pointsRoutes);

// Socket.io
io.use(socketSessionMiddleware);
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TraumaChat server running on port ${PORT}`);
});
