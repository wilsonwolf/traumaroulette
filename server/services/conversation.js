/**
 * @file Conversation data-access service.
 *
 * Provides CRUD-style helpers for the `conversations` table and
 * encapsulates all status transitions in the conversation lifecycle:
 *
 *   ACTIVE -> EXTENSION_PENDING  (handled by timer service)
 *   EXTENSION_PENDING -> PHOTO_EXCHANGE  (extendConversation)
 *   EXTENSION_PENDING -> FRIENDS_FOREVER (setFriendsForever)
 *   EXTENSION_PENDING -> CLOSED          (closeConversation)
 *   PHOTO_EXCHANGE -> ACTIVE             (setActive, after ratings complete)
 *   any non-CLOSED -> CLOSED             (closeConversation)
 *
 * @module server/services/conversation
 */

const { getDb } = require('../db/init');
const { CONVERSATION_STATUS } = require('../../shared/constants');

/**
 * Fetches a conversation by its database ID.
 *
 * @param {number} conversationId
 * @returns {Object|undefined} The conversation row, or undefined if not found.
 */
function getConversation(conversationId) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
}

/**
 * Fetches a conversation by its Socket.IO room ID (UUID).
 *
 * @param {string} roomId - The UUID room identifier.
 * @returns {Object|undefined} The conversation row, or undefined if not found.
 */
function getConversationByRoom(roomId) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE room_id = ?').get(roomId);
}

/**
 * Determines the partner's user ID in a two-person conversation.
 *
 * Since conversations always have exactly two participants (user1 and user2),
 * this returns whichever one is NOT the supplied userId.
 *
 * @param {Object} conversation - A conversation row from the database.
 * @param {number} userId       - The "current" user's ID.
 * @returns {number} The partner's user ID.
 */
function getPartnerUserId(conversation, userId) {
  return conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
}

/**
 * Closes a conversation by setting its status to CLOSED.
 *
 * @param {number} conversationId
 */
function closeConversation(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.CLOSED, conversationId);
}

/**
 * Promotes a conversation to "Friends Forever" status.
 *
 * Sets the status to FRIENDS_FOREVER and flips the `is_friends_forever`
 * flag to 1.  This is a terminal positive state -- the conversation is
 * no longer time-limited and the users retain permanent access.
 *
 * @param {number} conversationId
 */
function setFriendsForever(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ?, is_friends_forever = 1 WHERE id = ?')
    .run(CONVERSATION_STATUS.FRIENDS_FOREVER, conversationId);
}

/**
 * Extends a conversation into the photo-exchange phase.
 *
 * Increments the `extensions_count` (used for streak-bonus calculations)
 * and transitions the status to PHOTO_EXCHANGE.  Returns the updated
 * conversation row so callers can read the new extensions_count.
 *
 * @param {number} conversationId
 * @returns {Object} The updated conversation row.
 */
function extendConversation(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET extensions_count = extensions_count + 1, status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.PHOTO_EXCHANGE, conversationId);
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
}

/**
 * Resets a conversation's status to ACTIVE.
 *
 * Called after both users complete the photo-exchange and rating flow,
 * just before a new timer is started.
 *
 * @param {number} conversationId
 */
function setActive(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.ACTIVE, conversationId);
}

/**
 * Finds the most recent non-closed conversation for a given user.
 *
 * Returns conversations in any "live" status (active, extension_pending,
 * photo_exchange, or friends_forever).  Used primarily during reconnect
 * to determine whether the user should rejoin an existing room.
 *
 * @param {number} userId
 * @returns {Object|undefined} The conversation row, or undefined if none is active.
 */
function getActiveConversationForUser(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM conversations
    WHERE (user1_id = ? OR user2_id = ?)
    AND status IN ('active', 'extension_pending', 'photo_exchange', 'friends_forever')
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, userId);
}

module.exports = {
  getConversation,
  getConversationByRoom,
  getPartnerUserId,
  closeConversation,
  setFriendsForever,
  extendConversation,
  setActive,
  getActiveConversationForUser,
};
