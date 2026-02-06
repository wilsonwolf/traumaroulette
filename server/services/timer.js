/**
 * @file Conversation timer service.
 *
 * Manages the countdown timer that limits how long two users can chat
 * before they must decide whether to extend.  Each conversation room
 * has at most one active timer at a time.
 *
 * Timer lifecycle:
 *   1. {@link startTimer} is called when a conversation begins (or resumes
 *      after a photo exchange).
 *   2. After `(TIMER_SECONDS - TIMER_WARNING_SECONDS)` milliseconds, a
 *      TIMER_WARNING event is emitted.
 *   3. After the full `TIMER_SECONDS` duration, TIMER_EXPIRED and
 *      EXTENSION_PROMPT events are emitted, and the conversation status
 *      transitions to EXTENSION_PENDING.
 *   4. {@link clearTimer} cancels both timeouts (e.g. if the conversation
 *      is closed early or the users vote).
 *
 * All timer handles are stored in the `activeTimers` Map so they can be
 * cancelled deterministically.
 *
 * @module server/services/timer
 */

const { TIMER_SECONDS, TIMER_WARNING_SECONDS, EVENTS, CONVERSATION_STATUS } = require('../../shared/constants');
const { getDb } = require('../db/init');

/**
 * In-memory store of running timers, keyed by Socket.IO room ID.
 * Each value holds both the main expiry timeout and the warning timeout.
 * @type {Map<string, { timeout: NodeJS.Timeout, warningTimeout: NodeJS.Timeout }>}
 */
const activeTimers = new Map();

/**
 * Starts the countdown timer for a conversation.
 *
 * Any previously running timer for the same room is cleared first to
 * prevent stale timeouts from firing.
 *
 * Side effects:
 *   - Persists the computed `endTime` to the conversations table so the
 *     client can display an accurate countdown even after a page refresh.
 *   - Emits TIMER_START to the room immediately.
 *   - Schedules a TIMER_WARNING emission at `TIMER_SECONDS - TIMER_WARNING_SECONDS`.
 *   - Schedules TIMER_EXPIRED + EXTENSION_PROMPT at `TIMER_SECONDS` and
 *     transitions the conversation status to EXTENSION_PENDING.
 *
 * @param {import('socket.io').Server} io             - The Socket.IO server instance.
 * @param {string}                     roomId         - The Socket.IO room ID for this conversation.
 * @param {number}                     conversationId - The conversation's database ID.
 */
function startTimer(io, roomId, conversationId) {
  // Cancel any existing timer for this room to avoid duplicate expirations.
  clearTimer(roomId);

  const duration = TIMER_SECONDS * 1000;
  // The warning fires TIMER_WARNING_SECONDS before the end.
  const warningAt = (TIMER_SECONDS - TIMER_WARNING_SECONDS) * 1000;
  const endTime = new Date(Date.now() + duration).toISOString();

  // Persist the absolute end time so the client can reconstruct the
  // countdown on reconnect without relying on server-pushed deltas.
  const db = getDb();
  db.prepare('UPDATE conversations SET current_timer_end = ?, status = ? WHERE id = ?')
    .run(endTime, CONVERSATION_STATUS.ACTIVE, conversationId);

  // Notify both users that the timer has started.
  io.to(roomId).emit(EVENTS.TIMER_START, {
    duration: TIMER_SECONDS,
    endTime,
  });

  // Schedule the "time is almost up" warning.
  const warningTimeout = setTimeout(() => {
    io.to(roomId).emit(EVENTS.TIMER_WARNING, { secondsLeft: TIMER_WARNING_SECONDS });
  }, warningAt);

  // Schedule the actual expiration.
  const timeout = setTimeout(() => {
    // Remove our own entry before emitting so any re-entrant calls to
    // startTimer do not see a stale handle.
    activeTimers.delete(roomId);

    // Transition the conversation to the voting phase.
    db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
      .run(CONVERSATION_STATUS.EXTENSION_PENDING, conversationId);

    // Inform both users that time is up and they should vote.
    io.to(roomId).emit(EVENTS.TIMER_EXPIRED, { conversationId });
    io.to(roomId).emit(EVENTS.EXTENSION_PROMPT, { conversationId });
  }, duration);

  activeTimers.set(roomId, { timeout, warningTimeout });
}

/**
 * Cancels any running timer for the given room.
 *
 * Safe to call even if no timer is active (no-op in that case).
 *
 * @param {string} roomId - The Socket.IO room ID.
 */
function clearTimer(roomId) {
  const existing = activeTimers.get(roomId);
  if (existing) {
    clearTimeout(existing.timeout);
    clearTimeout(existing.warningTimeout);
    activeTimers.delete(roomId);
  }
}

module.exports = { startTimer, clearTimer, activeTimers };
