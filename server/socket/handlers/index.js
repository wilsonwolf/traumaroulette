/**
 * @file Core Socket.IO event handler setup -- the real-time engine of TraumaChat.
 *
 * This module wires up all socket events for matchmaking, chatting,
 * extension voting, photo exchange, rating, and disconnect handling.
 * It is the most complex module in the server because it orchestrates
 * the full conversation lifecycle as a state machine:
 *
 * ============================================================
 *  CONVERSATION LIFECYCLE STATE MACHINE
 * ============================================================
 *
 *   [Queue]
 *      |  (two users in queue -- tryMatch succeeds)
 *      v
 *   ACTIVE  <--------------------------------------+
 *      |  (TIMER_SECONDS elapse -- timer expires)  |
 *      v                                           |
 *   EXTENSION_PENDING                              |
 *      |                                           |
 *      +-- vote includes "leave"                   |
 *      |      --> CLOSED                           |
 *      |                                           |
 *      +-- both vote "friends_forever"             |
 *      |      --> FRIENDS_FOREVER (permanent)      |
 *      |                                           |
 *      +-- both vote "extend" (or mixed extend +   |
 *      |   friends_forever where not unanimous)    |
 *      |      --> PHOTO_EXCHANGE                   |
 *      |            |                              |
 *      |            | (both submit photos)         |
 *      |            v                              |
 *      |         PHOTO_REVEAL                      |
 *      |            |                              |
 *      |            | (both submit ratings)        |
 *      |            v                              |
 *      |         ACTIVE  (new timer starts) -------+
 *      v
 *   CLOSED  (terminal -- disconnect or "leave" vote)
 *
 * ============================================================
 *  DISCONNECT GRACE PERIOD
 * ============================================================
 *
 *   When a user disconnects, a 30-second grace timer starts.
 *   - If the user reconnects within 30 seconds, the timer is
 *     cancelled and they rejoin the conversation seamlessly.
 *   - If the timer fires, the conversation is closed and the
 *     remaining partner is notified.
 *
 * ============================================================
 *  IN-MEMORY TRACKING MAPS
 * ============================================================
 *
 *   pendingPhotos   : conversationId -> Set<userId>
 *     Tracks which users have submitted a photo in the current
 *     exchange round.  Once the set reaches size 2, the photos
 *     are revealed to both users.
 *
 *   pendingRatings  : conversationId -> Map<userId, score>
 *     Tracks which users have rated their partner's photo.
 *     Once both have rated, the photo-exchange phase ends,
 *     the conversation returns to ACTIVE, and a new timer starts.
 *
 *   disconnectTimers: userId -> NodeJS.Timeout
 *     Holds the 30-second grace-period timeout handle so it can
 *     be cancelled on reconnect.
 *
 * @module server/socket/handlers/index
 */

const { EVENTS, CONVERSATION_STATUS, MESSAGE_TYPES } = require('../../../shared/constants');
const { getDb } = require('../../db/init');
const matchmaker = require('../../services/matchmaker');
const { startTimer, clearTimer } = require('../../services/timer');
const conversationService = require('../../services/conversation');
const pointsService = require('../../services/points');

/**
 * Tracks which users have submitted a photo in the current exchange.
 * Key: conversationId.  Value: Set of userIds who have submitted.
 * @type {Map<number, Set<number>>}
 */
const pendingPhotos = new Map();

/**
 * Tracks which users have submitted a rating after the photo reveal.
 * Key: conversationId.  Value: Map of userId -> score.
 * @type {Map<number, Map<number, number>>}
 */
const pendingRatings = new Map();

/**
 * Holds the grace-period timeout handle for disconnected users.
 * Key: userId.  Value: the setTimeout handle.
 * If the user reconnects before the timeout fires, the handle is
 * cleared and the conversation continues.
 * @type {Map<number, NodeJS.Timeout>}
 */
const disconnectTimers = new Map();

/**
 * Registers all Socket.IO event handlers on the given server instance.
 *
 * Called once at server startup (from index.js).  Each new socket
 * connection gets its own set of event listeners within the
 * `io.on('connection', ...)` callback.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server instance.
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // socket.userId was attached by socketSessionMiddleware during handshake.
    const userId = socket.userId;
    console.log(`User ${userId} connected (socket ${socket.id})`);
    matchmaker.registerSocket(userId, socket.id);

    // ---------------------------------------------------------------
    //  RECONNECT HANDLING
    //  If this user disconnected recently and is still within the
    //  30-second grace period, cancel the disconnect timer and
    //  rejoin them to their active conversation room.
    // ---------------------------------------------------------------
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
      disconnectTimers.delete(userId);

      // Find the conversation that was in progress when the user dropped.
      const conv = conversationService.getActiveConversationForUser(userId);
      if (conv) {
        socket.join(conv.room_id);
        // Inform the client about the conversation they are rejoining
        // so it can restore the correct UI state.
        socket.emit('rejoin-conversation', {
          conversationId: conv.id,
          roomId: conv.room_id,
          status: conv.status,
          partnerId: conversationService.getPartnerUserId(conv, userId),
        });
      }
    }

    // ===============================================================
    //  MATCHMAKING
    // ===============================================================

    /**
     * JOIN_QUEUE: User wants to be matched with a random stranger.
     *
     * 1. Add the user to the matchmaking queue.
     * 2. Attempt to pair the first two users in the queue.
     * 3. If a match is found:
     *    a. Look up display info for both users.
     *    b. Join both sockets to a shared room.
     *    c. Award participation points.
     *    d. Emit MATCHED to each user (with the other's info).
     *    e. Insert an initial system message.
     *    f. Start the conversation timer.
     */
    socket.on(EVENTS.JOIN_QUEUE, () => {
      matchmaker.addToQueue(userId, socket.id);
      const match = matchmaker.tryMatch();
      if (match) {
        const { conversationId, roomId, user1, user2 } = match;
        const db = getDb();

        // Fetch minimal profile info to send to the partner.
        const u1 = db.prepare('SELECT id, display_name, photo_url FROM users WHERE id = ?').get(user1.userId);
        const u2 = db.prepare('SELECT id, display_name, photo_url FROM users WHERE id = ?').get(user2.userId);

        // Join both sockets into the shared Socket.IO room.
        // The guard (`if (s1)`) handles the unlikely case where a
        // socket disconnected between queue-join and match resolution.
        const s1 = io.sockets.sockets.get(user1.socketId);
        const s2 = io.sockets.sockets.get(user2.socketId);
        if (s1) s1.join(roomId);
        if (s2) s2.join(roomId);

        // Both users earn participation points just for being matched.
        pointsService.awardParticipation(user1.userId, conversationId);
        pointsService.awardParticipation(user2.userId, conversationId);

        // Each user receives MATCHED with the *other* user's profile.
        if (s1) s1.emit(EVENTS.MATCHED, { conversationId, roomId, partner: u2 });
        if (s2) s2.emit(EVENTS.MATCHED, { conversationId, roomId, partner: u1 });

        // Record a system message visible to both users in the chat history.
        db.prepare('INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)')
          .run(conversationId, user1.userId, MESSAGE_TYPES.SYSTEM, 'You have been matched! You have 3 minutes. Make them count.');

        // Kick off the countdown.
        startTimer(io, roomId, conversationId);
      }
    });

    /**
     * LEAVE_QUEUE: User no longer wants to be matched.
     * Simply removes them from the queue; no side effects.
     */
    socket.on(EVENTS.LEAVE_QUEUE, () => {
      matchmaker.removeFromQueue(userId);
    });

    // ===============================================================
    //  ROOM MANAGEMENT (reconnect / navigation)
    // ===============================================================

    /**
     * join-room: Explicitly joins a Socket.IO room.
     * Used when the client navigates back to an active conversation
     * page and needs to re-subscribe to room events.
     */
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
    });

    // ===============================================================
    //  CHAT (text + voice messages)
    // ===============================================================

    /**
     * SEND_MESSAGE: User sends a text message.
     *
     * Validates that the conversation exists and the sender is a
     * participant, persists the message to the database, then
     * broadcasts the full message row to the room so both users
     * see it in real time.
     */
    socket.on(EVENTS.SEND_MESSAGE, ({ conversationId, content }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;
      // Authorization check: only participants may send messages.
      if (conv.user1_id !== userId && conv.user2_id !== userId) return;

      const result = db.prepare(
        'INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)'
      ).run(conversationId, userId, MESSAGE_TYPES.TEXT, content);

      // Re-read the inserted row to get server-generated fields (id, created_at).
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      io.to(conv.room_id).emit(EVENTS.NEW_MESSAGE, message);
    });

    /**
     * SEND_VOICE_NOTE: User sends a voice recording.
     *
     * The actual audio file has already been uploaded via the REST
     * /api/upload/voice endpoint; this event only receives the
     * resulting URL and duration metadata.
     */
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

    // ===============================================================
    //  EXTENSION VOTING STATE MACHINE
    //
    //  After the timer expires the conversation enters EXTENSION_PENDING.
    //  Each user submits a vote: "extend", "leave", or "friends_forever".
    //
    //  Vote resolution rules (evaluated once both votes are in):
    //    - ANY "leave"              -> conversation CLOSED
    //    - BOTH "friends_forever"   -> FRIENDS_FOREVER (permanent)
    //    - otherwise (extend/mixed) -> PHOTO_EXCHANGE
    //
    //  The round number (extensions_count + 1) ensures that stale votes
    //  from previous rounds are not double-counted.
    // ===============================================================

    /**
     * EXTENSION_VOTE: User submits their extension vote.
     *
     * @param {Object} payload
     * @param {number} payload.conversationId
     * @param {string} payload.vote - One of "extend", "leave", "friends_forever".
     */
    socket.on(EVENTS.EXTENSION_VOTE, ({ conversationId, vote }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);

      // Only accept votes when the conversation is awaiting them.
      if (!conv || conv.status !== CONVERSATION_STATUS.EXTENSION_PENDING) return;

      // Round number is derived from the current extensions_count so each
      // voting cycle gets its own namespace in the extension_votes table.
      const round = conv.extensions_count + 1;

      // Persist the vote.
      db.prepare('INSERT INTO extension_votes (conversation_id, user_id, round, vote) VALUES (?, ?, ?, ?)')
        .run(conversationId, userId, round, vote);

      // Retrieve all votes for this round to see if we can resolve.
      const votes = db.prepare(
        'SELECT * FROM extension_votes WHERE conversation_id = ? AND round = ?'
      ).all(conversationId, round);

      if (votes.length < 2) {
        // Only one user has voted so far -- acknowledge and wait.
        socket.emit('vote-received', { waiting: true });
        return;
      }

      // --- Both votes are in -- resolve the round ---

      // Build a userId -> vote map.  Using an object (rather than the
      // raw array) deduplicates in the unlikely event of a double-submit.
      const voteMap = {};
      votes.forEach(v => { voteMap[v.user_id] = v.vote; });
      const voteValues = Object.values(voteMap);

      let result;

      if (voteValues.includes('leave')) {
        // --------------------------------------------------
        // OUTCOME: CLOSED
        // At least one user chose "leave". The conversation
        // ends immediately; the timer (if any) is cancelled.
        // --------------------------------------------------
        result = 'closed';
        conversationService.closeConversation(conversationId);
        clearTimer(conv.room_id);
        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'closed', conversationId });
        io.to(conv.room_id).emit(EVENTS.CONVERSATION_CLOSED, { conversationId, reason: 'Someone chose to leave' });
      } else if (voteValues.every(v => v === 'friends_forever')) {
        // --------------------------------------------------
        // OUTCOME: FRIENDS FOREVER
        // Both users voted "friends_forever". The conversation
        // becomes permanent (no more timers), and both receive
        // the large friends-forever point bonus.
        // --------------------------------------------------
        result = 'friends_forever';
        conversationService.setFriendsForever(conversationId);
        clearTimer(conv.room_id);
        pointsService.awardFriendsForever(conv.user1_id, conversationId);
        pointsService.awardFriendsForever(conv.user2_id, conversationId);
        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'friends_forever', conversationId });
        io.to(conv.room_id).emit(EVENTS.FRIENDS_FOREVER_CONFIRMED, { conversationId });
      } else {
        // --------------------------------------------------
        // OUTCOME: PHOTO EXCHANGE (extend)
        // The remaining case covers "extend" + "extend",
        // "extend" + "friends_forever", or "friends_forever" +
        // "extend".  In all cases the conversation is extended
        // and enters the photo-exchange phase.
        // --------------------------------------------------
        result = 'photo_exchange';
        const updated = conversationService.extendConversation(conversationId);

        // Award extension points (with possible streak bonus).
        pointsService.awardExtension(conv.user1_id, conversationId, updated.extensions_count);
        pointsService.awardExtension(conv.user2_id, conversationId, updated.extensions_count);

        // Initialise the in-memory tracking sets for this exchange round.
        pendingPhotos.set(conversationId, new Set());
        pendingRatings.set(conversationId, new Map());

        io.to(conv.room_id).emit(EVENTS.EXTENSION_RESULT, { result: 'photo_exchange', conversationId });
        io.to(conv.room_id).emit(EVENTS.PHOTO_EXCHANGE_START, { conversationId });
      }
    });

    // ===============================================================
    //  PHOTO EXCHANGE FLOW
    //
    //  During the photo-exchange phase each user uploads a photo via
    //  the REST API and then submits the URL through this socket event.
    //  Photos are persisted to the photo_exchanges table.
    //
    //  Once both users have submitted:
    //    1. The two most recent photos for this conversation are fetched.
    //    2. A PHOTO_EXCHANGE_REVEAL event is emitted to both users with
    //       both photos, enabling a simultaneous reveal in the UI.
    //  Until then, the first submitter receives a "photo-received"
    //  acknowledgment indicating they are waiting for their partner.
    // ===============================================================

    /**
     * PHOTO_EXCHANGE_SUBMIT: User submits their photo for the exchange.
     *
     * @param {Object} payload
     * @param {number} payload.conversationId
     * @param {string} payload.photoUrl - Server-relative URL from the upload endpoint.
     */
    socket.on(EVENTS.PHOTO_EXCHANGE_SUBMIT, ({ conversationId, photoUrl }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;

      // Persist the photo submission.
      db.prepare('INSERT INTO photo_exchanges (conversation_id, sender_id, photo_url) VALUES (?, ?, ?)')
        .run(conversationId, userId, photoUrl);

      // Lazily initialise the pending set (handles edge cases like
      // server restart mid-exchange where the Map entry was lost).
      if (!pendingPhotos.has(conversationId)) {
        pendingPhotos.set(conversationId, new Set());
      }
      pendingPhotos.get(conversationId).add(userId);

      // Check if both users have now submitted their photos.
      if (pendingPhotos.get(conversationId).size >= 2) {
        // Fetch the two most recent photo submissions for this conversation
        // (there may be older ones from previous extension rounds).
        const photos = db.prepare(
          'SELECT * FROM photo_exchanges WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 2'
        ).all(conversationId);

        // Reveal both photos simultaneously to both users.
        io.to(conv.room_id).emit(EVENTS.PHOTO_EXCHANGE_REVEAL, {
          conversationId,
          photos: photos.map(p => ({ userId: p.sender_id, photoUrl: p.photo_url })),
        });
      } else {
        // First user submitted -- acknowledge and wait for the partner.
        socket.emit('photo-received', { waiting: true });
      }
    });

    // ===============================================================
    //  PHOTO RATING
    //
    //  After the photo reveal, each user rates their partner's photo
    //  on a 1-5 star scale.  Points are awarded to the RATED user
    //  (not the rater) proportionally to the score.
    //
    //  Once both ratings are in:
    //    1. Clean up the in-memory tracking maps.
    //    2. Transition the conversation back to ACTIVE.
    //    3. Start a fresh countdown timer.
    //  This cycle can repeat indefinitely as long as both users
    //  keep voting "extend".
    // ===============================================================

    /**
     * RATE_PHOTO: User rates their partner's photo.
     *
     * @param {Object} payload
     * @param {number} payload.conversationId
     * @param {number} payload.score - Star rating (1-5).
     */
    socket.on(EVENTS.RATE_PHOTO, ({ conversationId, score }) => {
      const db = getDb();
      const conv = conversationService.getConversation(conversationId);
      if (!conv) return;

      // Determine who is being rated (the partner).
      const ratedId = conversationService.getPartnerUserId(conv, userId);

      // Persist the rating.
      db.prepare('INSERT INTO ratings (conversation_id, rater_id, rated_id, score) VALUES (?, ?, ?, ?)')
        .run(conversationId, userId, ratedId, score);

      // Award points to the person being rated (not the rater).
      pointsService.awardRating(ratedId, conversationId, score);

      // Track this rating in-memory.
      if (!pendingRatings.has(conversationId)) {
        pendingRatings.set(conversationId, new Map());
      }
      pendingRatings.get(conversationId).set(userId, score);

      // Send a real-time notification to the rated user so they can
      // see the score immediately (before the rating phase completes).
      const ratedSocketId = matchmaker.getSocketId(ratedId);
      if (ratedSocketId) {
        const ratedSocket = io.sockets.sockets.get(ratedSocketId);
        if (ratedSocket) {
          ratedSocket.emit(EVENTS.RATING_RECEIVED, { score, raterId: userId });
        }
      }

      // Once both users have rated, the photo-exchange phase is complete.
      if (pendingRatings.get(conversationId).size >= 2) {
        // Clean up in-memory tracking for this conversation.
        pendingPhotos.delete(conversationId);
        pendingRatings.delete(conversationId);

        // Transition back to ACTIVE and start a new countdown timer,
        // continuing the conversation cycle.
        conversationService.setActive(conversationId);
        startTimer(io, conv.room_id, conversationId);
      }
    });

    // ===============================================================
    //  DISCONNECT HANDLING (with 30-second grace period)
    //
    //  When a socket disconnects we do NOT immediately close the
    //  conversation.  Instead we start a 30-second grace timer.
    //
    //  - If the user reconnects within 30 seconds (e.g. page refresh,
    //    temporary network blip), the timer is cancelled at the top of
    //    the 'connection' handler and the conversation continues.
    //  - If the 30 seconds elapse without a reconnect, the conversation
    //    is closed and the remaining partner is notified.
    //
    //  The grace period prevents accidental conversation loss from
    //  brief connectivity interruptions.
    // ===============================================================

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
      // Remove the user from the matchmaking queue (if they were waiting).
      matchmaker.removeFromQueue(userId);

      const conv = conversationService.getActiveConversationForUser(userId);
      if (conv && conv.status !== CONVERSATION_STATUS.CLOSED) {
        // Start the 30-second grace period.
        const timer = setTimeout(() => {
          disconnectTimers.delete(userId);

          // Re-fetch the conversation to check if it was closed by other
          // means (e.g. the partner also disconnected, or a vote resolved)
          // while we were waiting.
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
        }, 30000); // 30-second grace period
        disconnectTimers.set(userId, timer);
      }

      // Unregister the socket mapping (the userId -> socketId entry).
      matchmaker.unregisterSocket(userId);
    });
  });
}

module.exports = setupSocketHandlers;
