const TIMER_SECONDS = parseInt(process.env.DEV_TIMER_SECONDS || '180', 10);
const TIMER_WARNING_SECONDS = 30;

const POINTS = {
  PARTICIPATION: 10,
  EXTENSION: 25,
  RATING_MULTIPLIER: 5,
  FRIENDS_FOREVER: 100,
  STREAK_BONUS: 10,
  STREAK_THRESHOLD: 3,
};

const EVENTS = {
  // Matchmaking
  JOIN_QUEUE: 'join-queue',
  LEAVE_QUEUE: 'leave-queue',
  MATCHED: 'matched',

  // Chat
  SEND_MESSAGE: 'send-message',
  NEW_MESSAGE: 'new-message',
  SEND_VOICE_NOTE: 'send-voice-note',

  // Timer
  TIMER_START: 'timer-start',
  TIMER_WARNING: 'timer-warning',
  TIMER_EXPIRED: 'timer-expired',

  // Extension
  EXTENSION_PROMPT: 'extension-prompt',
  EXTENSION_VOTE: 'extension-vote',
  EXTENSION_RESULT: 'extension-result',

  // Photo Exchange
  PHOTO_EXCHANGE_START: 'photo-exchange-start',
  PHOTO_EXCHANGE_SUBMIT: 'photo-exchange-submit',
  PHOTO_EXCHANGE_REVEAL: 'photo-exchange-reveal',

  // Rating
  RATE_PHOTO: 'rate-photo',
  RATING_RECEIVED: 'rating-received',

  // Friends Forever
  FRIENDS_FOREVER_CONFIRMED: 'friends-forever-confirmed',

  // Lifecycle
  PARTNER_DISCONNECTED: 'partner-disconnected',
  CONVERSATION_CLOSED: 'conversation-closed',
};

const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  EXTENSION_PENDING: 'extension_pending',
  PHOTO_EXCHANGE: 'photo_exchange',
  EXTENDED: 'extended',
  FRIENDS_FOREVER: 'friends_forever',
  CLOSED: 'closed',
};

const MESSAGE_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
  SYSTEM: 'system',
};

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
