const { getDb } = require('../db/init');
const { CONVERSATION_STATUS } = require('../../shared/constants');

function getConversation(conversationId) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
}

function getConversationByRoom(roomId) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE room_id = ?').get(roomId);
}

function getPartnerUserId(conversation, userId) {
  return conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
}

function closeConversation(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.CLOSED, conversationId);
}

function setFriendsForever(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ?, is_friends_forever = 1 WHERE id = ?')
    .run(CONVERSATION_STATUS.FRIENDS_FOREVER, conversationId);
}

function extendConversation(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET extensions_count = extensions_count + 1, status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.PHOTO_EXCHANGE, conversationId);
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
}

function setActive(conversationId) {
  const db = getDb();
  db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
    .run(CONVERSATION_STATUS.ACTIVE, conversationId);
}

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
