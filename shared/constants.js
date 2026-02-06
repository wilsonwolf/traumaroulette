/**
 * @file Shared constants used by both the server and the client.
 *
 * Defines all timing values, point awards, Socket.IO event names,
 * conversation lifecycle statuses, message types, and voice-note limits.
 * This is the single source of truth -- both client and server import
 * from this file so the values are always in sync.
 *
 * @module shared/constants
 */

/**
 * Duration (in seconds) of the initial conversation timer.
 * Can be overridden via the DEV_TIMER_SECONDS environment variable
 * (useful for shorter timers during development / testing).
 * @type {number}
 */
const TIMER_SECONDS = parseInt(process.env.DEV_TIMER_SECONDS || '180', 10);

/**
 * Number of seconds before the timer expires at which a warning
 * event is emitted to both users in the conversation.
 * @type {number}
 */
const TIMER_WARNING_SECONDS = 30;

/**
 * Point values and thresholds for the gamification system.
 * Points are awarded for various in-app actions and contribute
 * to the leaderboard ranking.
 *
 * @type {Object}
 * @property {number} PARTICIPATION   - Points awarded to each user upon being matched.
 * @property {number} EXTENSION       - Base points for agreeing to extend a conversation.
 * @property {number} RATING_MULTIPLIER - Multiplied by the star rating (1-5) to compute rating points.
 * @property {number} FRIENDS_FOREVER - Bonus points when both users choose "Friends Forever".
 * @property {number} STREAK_BONUS    - Extra points on top of EXTENSION when the streak threshold is met.
 * @property {number} STREAK_THRESHOLD - Minimum consecutive extensions needed to trigger the streak bonus.
 */
const POINTS = {
  PARTICIPATION: 10,
  EXTENSION: 25,
  RATING_MULTIPLIER: 5,
  FRIENDS_FOREVER: 100,
  STREAK_BONUS: 10,
  STREAK_THRESHOLD: 3,
};

/**
 * Socket.IO event name constants.
 *
 * Grouped by feature area.  Both the client and the server reference
 * these constants so event names stay consistent across the codebase.
 *
 * @type {Object.<string, string>}
 */
const EVENTS = {
  // -- Matchmaking --
  /** Client -> Server: user wants to enter the random-match queue. */
  JOIN_QUEUE: 'join-queue',
  /** Client -> Server: user wants to leave the queue before being matched. */
  LEAVE_QUEUE: 'leave-queue',
  /** Server -> Client: two users have been paired; includes partner info and room ID. */
  MATCHED: 'matched',

  // -- Chat --
  /** Client -> Server: user sends a text message within a conversation. */
  SEND_MESSAGE: 'send-message',
  /** Server -> Client (room broadcast): a new message is available. */
  NEW_MESSAGE: 'new-message',
  /** Client -> Server: user sends a recorded voice note. */
  SEND_VOICE_NOTE: 'send-voice-note',

  // -- Timer --
  /** Server -> Client: the countdown timer has started (includes duration and end time). */
  TIMER_START: 'timer-start',
  /** Server -> Client: the timer is about to expire (TIMER_WARNING_SECONDS remaining). */
  TIMER_WARNING: 'timer-warning',
  /** Server -> Client: the timer has reached zero. */
  TIMER_EXPIRED: 'timer-expired',

  // -- Extension Voting --
  /** Server -> Client: prompts both users to vote on extending the conversation. */
  EXTENSION_PROMPT: 'extension-prompt',
  /** Client -> Server: user submits their extension vote ("extend", "leave", or "friends_forever"). */
  EXTENSION_VOTE: 'extension-vote',
  /** Server -> Client: the combined result of both votes (closed / photo_exchange / friends_forever). */
  EXTENSION_RESULT: 'extension-result',

  // -- Photo Exchange --
  /** Server -> Client: the photo-exchange phase has begun. */
  PHOTO_EXCHANGE_START: 'photo-exchange-start',
  /** Client -> Server: user submits their photo for the exchange. */
  PHOTO_EXCHANGE_SUBMIT: 'photo-exchange-submit',
  /** Server -> Client: both photos are ready; reveal them to both users simultaneously. */
  PHOTO_EXCHANGE_REVEAL: 'photo-exchange-reveal',

  // -- Rating --
  /** Client -> Server: user rates their partner's photo (1-5 stars). */
  RATE_PHOTO: 'rate-photo',
  /** Server -> Client: notifies the rated user of the score they received. */
  RATING_RECEIVED: 'rating-received',

  // -- Friends Forever --
  /** Server -> Client: both users chose "Friends Forever" -- relationship is permanent. */
  FRIENDS_FOREVER_CONFIRMED: 'friends-forever-confirmed',

  // -- Lifecycle --
  /** Server -> Client: the partner has disconnected (after grace period expired). */
  PARTNER_DISCONNECTED: 'partner-disconnected',
  /** Server -> Client: the conversation has been closed (includes reason string). */
  CONVERSATION_CLOSED: 'conversation-closed',
};

/**
 * Conversation lifecycle statuses.
 *
 * A conversation progresses through these states:
 *   ACTIVE -> EXTENSION_PENDING -> (PHOTO_EXCHANGE -> ACTIVE)* -> CLOSED
 *                                \-> FRIENDS_FOREVER
 *                                \-> CLOSED
 *
 * @type {Object.<string, string>}
 * @property {string} ACTIVE            - Timer is running; users are chatting.
 * @property {string} EXTENSION_PENDING - Timer expired; waiting for both users to vote.
 * @property {string} PHOTO_EXCHANGE    - Extension approved; users are exchanging photos.
 * @property {string} EXTENDED          - (Reserved) indicates the conversation was extended.
 * @property {string} FRIENDS_FOREVER   - Both users chose "Friends Forever" -- no timer, permanent chat.
 * @property {string} CLOSED            - Conversation has ended (by vote, disconnect, or manual close).
 */
const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  EXTENSION_PENDING: 'extension_pending',
  PHOTO_EXCHANGE: 'photo_exchange',
  EXTENDED: 'extended',
  FRIENDS_FOREVER: 'friends_forever',
  CLOSED: 'closed',
};

/**
 * Types of messages that can appear in a conversation.
 *
 * @type {Object.<string, string>}
 * @property {string} TEXT   - A regular text message sent by a user.
 * @property {string} VOICE  - A voice note (audio recording) sent by a user.
 * @property {string} SYSTEM - An automated system message (e.g. "You have been matched!").
 */
const MESSAGE_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
  SYSTEM: 'system',
};

/**
 * Maximum allowed duration (in seconds) for a single voice note recording.
 * @type {number}
 */
const VOICE_MAX_SECONDS = 60;

module.exports = {
  TIMER_SECONDS,
  TIMER_WARNING_SECONDS,
  POINTS,
  EVENTS,
  CONVERSATION_STATUS,
  MESSAGE_TYPES,
  VOICE_MAX_SECONDS,
};
