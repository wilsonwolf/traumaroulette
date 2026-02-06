const { TIMER_SECONDS, TIMER_WARNING_SECONDS, EVENTS, CONVERSATION_STATUS } = require('../../shared/constants');
const { getDb } = require('../db/init');

// Map roomId -> { timeout, warningTimeout }
const activeTimers = new Map();

function startTimer(io, roomId, conversationId) {
  clearTimer(roomId);

  const duration = TIMER_SECONDS * 1000;
  const warningAt = (TIMER_SECONDS - TIMER_WARNING_SECONDS) * 1000;
  const endTime = new Date(Date.now() + duration).toISOString();

  const db = getDb();
  db.prepare('UPDATE conversations SET current_timer_end = ?, status = ? WHERE id = ?')
    .run(endTime, CONVERSATION_STATUS.ACTIVE, conversationId);

  io.to(roomId).emit(EVENTS.TIMER_START, {
    duration: TIMER_SECONDS,
    endTime,
  });

  const warningTimeout = setTimeout(() => {
    io.to(roomId).emit(EVENTS.TIMER_WARNING, { secondsLeft: TIMER_WARNING_SECONDS });
  }, warningAt);

  const timeout = setTimeout(() => {
    activeTimers.delete(roomId);
    db.prepare('UPDATE conversations SET status = ? WHERE id = ?')
      .run(CONVERSATION_STATUS.EXTENSION_PENDING, conversationId);
    io.to(roomId).emit(EVENTS.TIMER_EXPIRED, { conversationId });
    io.to(roomId).emit(EVENTS.EXTENSION_PROMPT, { conversationId });
  }, duration);

  activeTimers.set(roomId, { timeout, warningTimeout });
}

function clearTimer(roomId) {
  const existing = activeTimers.get(roomId);
  if (existing) {
    clearTimeout(existing.timeout);
    clearTimeout(existing.warningTimeout);
    activeTimers.delete(roomId);
  }
}

module.exports = { startTimer, clearTimer, activeTimers };
