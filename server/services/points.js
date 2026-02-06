const { getDb } = require('../db/init');
const { POINTS } = require('../../shared/constants');

function awardPoints(userId, conversationId, eventType, points, description) {
  const db = getDb();
  db.prepare('INSERT INTO points_log (user_id, conversation_id, event_type, points, description) VALUES (?, ?, ?, ?, ?)')
    .run(userId, conversationId, eventType, points, description);
  db.prepare('UPDATE users SET total_points = total_points + ? WHERE id = ?')
    .run(points, userId);
}

function awardParticipation(userId, conversationId) {
  awardPoints(userId, conversationId, 'participation', POINTS.PARTICIPATION, 'Matched with a stranger');
}

function awardExtension(userId, conversationId, extensionsCount) {
  let pts = POINTS.EXTENSION;
  let desc = 'Extended conversation';
  if (extensionsCount >= POINTS.STREAK_THRESHOLD) {
    pts += POINTS.STREAK_BONUS;
    desc += ` (streak bonus! ${extensionsCount} extensions)`;
  }
  awardPoints(userId, conversationId, 'extension', pts, desc);
}

function awardRating(userId, conversationId, score) {
  const pts = score * POINTS.RATING_MULTIPLIER;
  awardPoints(userId, conversationId, 'rating', pts, `Rated ${score} stars`);
}

function awardFriendsForever(userId, conversationId) {
  awardPoints(userId, conversationId, 'friends_forever', POINTS.FRIENDS_FOREVER, 'Friends forever!');
}

module.exports = {
  awardPoints,
  awardParticipation,
  awardExtension,
  awardRating,
  awardFriendsForever,
};
