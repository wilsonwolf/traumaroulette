const { EVENTS, CONVERSATION_STATUS, MESSAGE_TYPES } = require('../../../shared/constants');
const { getDb } = require('../../db/init');
const matchmaker = require('../../services/matchmaker');
const { startTimer, clearTimer } = require('../../services/timer');
const conversationService = require('../../services/conversation');
const pointsService = require('../../services/points');

// Track pending photo exchanges: conversationId -> Set of userIds who submitted
const pendingPhotos = new Map();
// Track pending ratings: conversationId -> Map of userId -> score
const pendingRatings = new Map();
// Track disconnected users for grace period: userId -> timeout
const disconnectTimers = new Map();

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User ${userId} connected (socket ${socket.id})`);
    matchmaker.registerSocket(userId, socket.id);

    // Clear any disconnect timer for this user (reconnect)
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
      disconnectTimers.delete(userId);
      // Rejoin any active conversation room
      const conv = conversationService.getActiveConversationForUser(userId);
      if (conv) {
        socket.join(conv.room_id);
        socket.emit('rejoin-conversation', {
          conversationId: conv.id,
          roomId: conv.room_id,
          status: conv.status,
          partnerId: conversationService.getPartnerUserId(conv, userId),
        });
      }
    }

    // --- MATCHMAKING ---
    socket.on(EVENTS.JOIN_QUEUE, () => {
      matchmaker.addToQueue(userId, socket.id);
      const match = matchmaker.tryMatch();
      if (match) {
        const { conversationId, roomId, user1, user2 } = match;
        const db = getDb();
        const u1 = db.prepare('SELECT id, display_name, photo_url FROM users WHERE id = ?').get(user1.userId);
        const u2 = db.prepare('SELECT id, display_name, photo_url FROM users WHERE id = ?').get(user2.userId);

        // Both join room
        const s1 = io.sockets.sockets.get(user1.socketId);
        const s2 = io.sockets.sockets.get(user2.socketId);
        if (s1) s1.join(roomId);
        if (s2) s2.join(roomId);

        // Award participation points
        pointsService.awardParticipation(user1.userId, conversationId);
        pointsService.awardParticipation(user2.userId, conversationId);

        // Notify both
        if (s1) s1.emit(EVENTS.MATCHED, { conversationId, roomId, partner: u2 });
        if (s2) s2.emit(EVENTS.MATCHED, { conversationId, roomId, partner: u1 });

        // System message
        db.prepare('INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)')
          .run(conversationId, user1.userId, MESSAGE_TYPES.SYSTEM, 'You have been matched! You have 3 minutes. Make them count.');

        // Start timer
        startTimer(io, roomId, conversationId);
      }
    });

    socket.on(EVENTS.LEAVE_QUEUE, () => {
      matchmaker.removeFromQueue(userId);
    });

    // --- JOIN ROOM (for reconnects / navigation) ---
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
    });

    // --- CHAT ---
    socket.on(EVENTS.SEND_MESSAGE, ({ conversationId, content }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;
      if (conv.user1_id !== userId && conv.user2_id !== userId) return;

      const result = db.prepare(
        'INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)'
      ).run(conversationId, userId, MESSAGE_TYPES.TEXT, content);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      io.to(conv.room_id).emit(EVENTS.NEW_MESSAGE, message);
    });

    socket.on(EVENTS.SEND_VOICE_NOTE, ({ conversationId, voiceUrl, duration }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;
      if (conv.user1_id !== userId && conv.user2_id !== userId) return;

      const result = db.prepare(
        'INSERT INTO messages (conversation_id, sender_id, message_type, voice_url, voice_duration) VALUES (?, ?, ?, ?, ?)'
      ).run(conversationId, userId, MESSAGE_TYPES.VOICE, voiceUrl, duration);

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      io.to(conv.room_id).emit(EVENTS.NEW_MESSAGE, message);
    });

    // --- EXTENSION VOTING ---
    socket.on(EVENTS.EXTENSION_VOTE, ({ conversationId, vote }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv || conv.status !== CONVERSATION_STATUS.EXTENSION_PENDING) return;

      const round = conv.extensions_count + 1;

      // Store vote
      db.prepare('INSERT INTO extension_votes (conversation_id, user_id, round, vote) VALUES (?, ?, ?, ?)')
        .run(conversationId, userId, round, vote);

      // Check if both voted
      const votes = db.prepare(
        'SELECT * FROM extension_votes WHERE conversation_id = ? AND round = ?'
      ).all(conversationId, round);

      if (votes.length < 2) {
        // Waiting for other player
        socket.emit('vote-received', { waiting: true });
        return;
      }

      // Both voted - resolve
      const voteMap = {};
      votes.forEach(v => { voteMap[v.user_id] = v.vote; });
      const voteValues = Object.values(voteMap);

      let result;

      if (voteValues.includes('leave')) {
        // Someone wants to leave
        result = 'closed';
        conversationService.closeConversation(conversationId);
        clearTimer(conv.room_id);
        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'closed', conversationId });
        io.to(conv.room_id).emit(EVENTS.CONVERSATION_CLOSED, { conversationId, reason: 'Someone chose to leave' });
      } else if (voteValues.every(v => v === 'friends_forever')) {
        // Both want friends forever!
        result = 'friends_forever';
        conversationService.setFriendsForever(conversationId);
        clearTimer(conv.room_id);
        pointsService.awardFriendsForever(conv.user1_id, conversationId);
        pointsService.awardFriendsForever(conv.user2_id, conversationId);
        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'friends_forever', conversationId });
        io.to(conv.room_id).emit(EVENTS.FRIENDS_FOREVER_CONFIRMED, { conversationId });
      } else {
        // Extend with photo exchange
        result = 'photo_exchange';
        const updated = conversationService.extendConversation(conversationId);
        pointsService.awardExtension(conv.user1_id, conversationId, updated.extensions_count);
        pointsService.awardExtension(conv.user2_id, conversationId, updated.extensions_count);
        pendingPhotos.set(conversationId, new Set());
        pendingRatings.set(conversationId, new Map());
        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'photo_exchange', conversationId });
        io.to(conv.room_id).emit(EVENTS.PHOTO_EXCHANGE_START, { conversationId });
      }
    });

    // --- PHOTO EXCHANGE ---
    socket.on(EVENTS.PHOTO_EXCHANGE_SUBMIT, ({ conversationId, photoUrl }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;

      db.prepare('INSERT INTO photo_exchanges (conversation_id, sender_id, photo_url) VALUES (?, ?, ?)')
        .run(conversationId, userId, photoUrl);

      if (!pendingPhotos.has(conversationId)) {
        pendingPhotos.set(conversationId, new Set());
      }
      pendingPhotos.get(conversationId).add(userId);

      // Check if both submitted
      if (pendingPhotos.get(conversationId).size >= 2) {
        const photos = db.prepare(
          'SELECT * FROM photo_exchanges WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 2'
        ).all(conversationId);

        io.to(conv.room_id).emit(EVENTS.PHOTO_EXCHANGE_REVEAL, {
          conversationId,
          photos: photos.map(p => ({ userId: p.sender_id, photoUrl: p.photo_url })),
        });
      } else {
        socket.emit('photo-received', { waiting: true });
      }
    });

    // --- RATING ---
    socket.on(EVENTS.RATE_PHOTO, ({ conversationId, score }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;

      const ratedId = conversationService.getPartnerUserId(conv, userId);

      db.prepare('INSERT INTO ratings (conversation_id, rater_id, rated_id, score) VALUES (?, ?, ?, ?)')
        .run(conversationId, userId, ratedId, score);

      pointsService.awardRating(ratedId, conversationId, score);

      if (!pendingRatings.has(conversationId)) {
        pendingRatings.set(conversationId, new Map());
      }
      pendingRatings.get(conversationId).set(userId, score);

      // Notify rated user
      const ratedSocketId = matchmaker.getSocketId(ratedId);
      if (ratedSocketId) {
        const ratedSocket = io.sockets.sockets.get(ratedSocketId);
        if (ratedSocket) {
          ratedSocket.emit(EVENTS.RATING_RECEIVED, { score, raterId: userId });
        }
      }

      // Check if both rated
      if (pendingRatings.get(conversationId).size >= 2) {
        pendingPhotos.delete(conversationId);
        pendingRatings.delete(conversationId);

        // Start new timer
        conversationService.setActive(conversationId);
        startTimer(io, conv.room_id, conversationId);
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
      matchmaker.removeFromQueue(userId);

      const conv = conversationService.getActiveConversationForUser(userId);
      if (conv && conv.status !== CONVERSATION_STATUS.CLOSED) {
        // 30-second grace period
        const timer = setTimeout(() => {
          disconnectTimers.delete(userId);
          const freshConv = conversationService.getConversation(conv.id);
          if (freshConv && freshConv.status !== CONVERSATION_STATUS.CLOSED) {
            conversationService.closeConversation(conv.id);
            clearTimer(conv.room_id);
            io.to(conv.room_id).emit(EVENTS.PARTNER_DISCONNECTED, { conversationId: conv.id });
            io.to(conv.room_id).emit(EVENTS.CONVERSATION_CLOSED, {
              conversationId: conv.id,
              reason: 'Partner disconnected',
            });
          }
        }, 30000);
        disconnectTimers.set(userId, timer);
      }

      matchmaker.unregisterSocket(userId);
    });
  });
}

module.exports = setupSocketHandlers;
