/**
 * @file Matchmaking service -- manages the waiting queue and pairs
 * users into new conversations.
 *
 * All state is held in-memory:
 *   - `queue`       -- ordered list of users waiting for a match.
 *   - `userSockets` -- lookup from userId to their current socket ID
 *                      (used to address individual sockets from anywhere
 *                      in the server).
 *
 * When at least two users are in the queue, {@link tryMatch} dequeues
 * the first two, creates a new conversation row in SQLite, generates a
 * unique room ID (UUID v4), and returns the match details so the caller
 * (socket handler) can join both sockets to the room and start the timer.
 *
 * @module server/services/matchmaker
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/init');
const { CONVERSATION_STATUS } = require('../../shared/constants');

/**
 * In-memory matchmaking queue.
 * Each entry is an object with `{ userId: number, socketId: string }`.
 * Users are matched in FIFO order.
 * @type {Array<{ userId: number, socketId: string }>}
 */
const queue = [];

/**
 * Maps a user's database ID to their current Socket.IO socket ID.
 * Updated on every connect / disconnect and queue join so the server
 * can target specific users for direct emissions.
 * @type {Map<number, string>}
 */
const userSockets = new Map();

/**
 * Adds a user to the matchmaking queue.
 *
 * If the user is already queued (e.g. due to a reconnect), the stale
 * entry is removed first to prevent duplicates.
 *
 * @param {number} userId   - The user's database ID.
 * @param {string} socketId - The user's current Socket.IO socket ID.
 */
function addToQueue(userId, socketId) {
  // Remove any existing entry to avoid duplicate queue positions.
  removeFromQueue(userId);
  queue.push({ userId, socketId });
  userSockets.set(userId, socketId);
}

/**
 * Removes a user from the matchmaking queue (if present).
 *
 * @param {number} userId - The user's database ID.
 */
function removeFromQueue(userId) {
  const idx = queue.findIndex(q => q.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);
}

/**
 * Attempts to match the first two users in the queue.
 *
 * If fewer than two users are queued, returns null.
 * Otherwise, dequeues both users, creates a conversation record in the
 * database, and returns the match details.
 *
 * @returns {{ conversationId: number, roomId: string,
 *             user1: { userId: number, socketId: string },
 *             user2: { userId: number, socketId: string } } | null}
 *   The match result, or null if not enough users are queued.
 */
function tryMatch() {
  if (queue.length < 2) return null;

  // FIFO: the two longest-waiting users are paired.
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

/**
 * Registers (or updates) the socket ID for a connected user.
 * Called on every new socket connection.
 *
 * @param {number} userId   - The user's database ID.
 * @param {string} socketId - The user's current Socket.IO socket ID.
 */
function registerSocket(userId, socketId) {
  userSockets.set(userId, socketId);
}

/**
 * Unregisters a user's socket and removes them from the queue.
 * Called when a socket disconnects.
 *
 * @param {number} userId - The user's database ID.
 */
function unregisterSocket(userId) {
  userSockets.delete(userId);
  removeFromQueue(userId);
}

/**
 * Returns the current socket ID for a given user, or undefined
 * if the user is not connected.
 *
 * @param {number} userId - The user's database ID.
 * @returns {string|undefined} The socket ID, or undefined.
 */
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
