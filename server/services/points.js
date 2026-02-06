/**
 * @file Points (gamification) service.
 *
 * Centralises all point-award logic.  Every award is recorded in the
 * `points_log` table (immutable audit trail) AND atomically added to
 * the user's `total_points` column.
 *
 * Point values are defined in `shared/constants.js` (POINTS object).
 *
 * Award events:
 *   - **participation** -- earned when matched with a stranger.
 *   - **extension**     -- earned when a conversation is extended;
 *                          includes a streak bonus after STREAK_THRESHOLD
 *                          consecutive extensions.
 *   - **rating**        -- earned by the *rated* user; proportional to
 *                          the star score (score * RATING_MULTIPLIER).
 *   - **friends_forever** -- bonus for both users when they mutually
 *                            choose "Friends Forever".
 *
 * @module server/services/points
 */

const { getDb } = require('../db/init');
const { POINTS } = require('../../shared/constants');

/**
 * Low-level helper that inserts a points_log row and increments the
 * user's total_points in a single database transaction (implicit, as
 * each statement is synchronous via better-sqlite3).
 *
 * @param {number}      userId         - The user receiving the points.
 * @param {number}      conversationId - The associated conversation (for audit).
 * @param {string}      eventType      - Category key (participation, extension, rating, friends_forever).
 * @param {number}      points         - Number of points to award (always positive).
 * @param {string}      description    - Human-readable explanation for the log.
 */
function awardPoints(userId, conversationId, eventType, points, description) {
  const db = getDb();
  // Insert an immutable audit log entry.
  db.prepare('INSERT INTO points_log (user_id, conversation_id, event_type, points, description) VALUES (?, ?, ?, ?, ?)')
    .run(userId, conversationId, eventType, points, description);
  // Atomically update the running total on the user record.
  db.prepare('UPDATE users SET total_points = total_points + ? WHERE id = ?')
    .run(points, userId);
}

/**
 * Awards participation points when a user is matched with a stranger.
 *
 * @param {number} userId
 * @param {number} conversationId
 */
function awardParticipation(userId, conversationId) {
  awardPoints(userId, conversationId, 'participation', POINTS.PARTICIPATION, 'Matched with a stranger');
}

/**
 * Awards extension points when a conversation is extended.
 *
 * If the conversation has been extended at least STREAK_THRESHOLD
 * times, the user receives an additional STREAK_BONUS on top of the
 * base EXTENSION points.
 *
 * @param {number} userId
 * @param {number} conversationId
 * @param {number} extensionsCount - The total number of extensions for
 *                                   this conversation (including the current one).
 */
function awardExtension(userId, conversationId, extensionsCount) {
  let pts = POINTS.EXTENSION;
  let desc = 'Extended conversation';
  // Apply streak bonus once the threshold is met.
  if (extensionsCount >= POINTS.STREAK_THRESHOLD) {
    pts += POINTS.STREAK_BONUS;
    desc += ` (streak bonus! ${extensionsCount} extensions)`;
  }
  awardPoints(userId, conversationId, 'extension', pts, desc);
}

/**
 * Awards rating points to the user who was rated.
 *
 * The number of points is proportional to the score:
 *   points = score * RATING_MULTIPLIER
 *
 * @param {number} userId         - The user who RECEIVED the rating (not the rater).
 * @param {number} conversationId
 * @param {number} score          - Star rating (1-5).
 */
function awardRating(userId, conversationId, score) {
  const pts = score * POINTS.RATING_MULTIPLIER;
  awardPoints(userId, conversationId, 'rating', pts, `Rated ${score} stars`);
}

/**
 * Awards the "Friends Forever" bonus to a user.
 * Called for BOTH users when they mutually choose this option.
 *
 * @param {number} userId
 * @param {number} conversationId
 */
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
