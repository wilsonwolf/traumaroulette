const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/init');
const { CONVERSATION_STATUS } = require('../../shared/constants');

// In-memory queue: array of { userId, socketId }
const queue = [];

// Map userId -> socketId for connected users
const userSockets = new Map();

function addToQueue(userId, socketId) {
  // Remove if already in queue
  removeFromQueue(userId);
  queue.push({ userId, socketId });
  userSockets.set(userId, socketId);
}

function removeFromQueue(userId) {
  const idx = queue.findIndex(q => q.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);
}

function tryMatch() {
  if (queue.length < 2) return null;

  const user1 = queue.shift();
  const user2 = queue.shift();
  const roomId = uuidv4();

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO conversations (user1_id, user2_id, room_id, status) VALUES (?, ?, ?, ?)'
  ).run(user1.userId, user2.userId, roomId, CONVERSATION_STATUS.ACTIVE);

  return {
    conversationId: result.lastInsertRowid,
    roomId,
    user1,
    user2,
  };
}

function registerSocket(userId, socketId) {
  userSockets.set(userId, socketId);
}

function unregisterSocket(userId) {
  userSockets.delete(userId);
  removeFromQueue(userId);
}

function getSocketId(userId) {
  return userSockets.get(userId);
}

module.exports = {
  queue,
  userSockets,
  addToQueue,
  removeFromQueue,
  tryMatch,
  registerSocket,
  unregisterSocket,
  getSocketId,
};
