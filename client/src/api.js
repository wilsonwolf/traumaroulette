/**
 * @file api.js
 * @description REST API client wrapper for the TraumaChat application.
 *
 * Provides a centralized `api` object with methods for every server endpoint
 * (auth, users, uploads, conversations, points) as well as helpers for
 * managing the JWT session token stored in `sessionStorage`.
 *
 * All requests are routed through the internal `request()` function, which
 * automatically attaches the Bearer token, serializes JSON bodies, and
 * throws on non-2xx responses.
 */

/** @constant {string} API_BASE - Base path prefix for all REST endpoints. */
const API_BASE = '/api';

/**
 * Retrieves the JWT token from sessionStorage.
 *
 * @returns {string|null} The stored JWT token, or null if none exists.
 */
function getToken() {
  return sessionStorage.getItem('token');
}

/**
 * Persists a JWT token to sessionStorage.
 *
 * @param {string} token - The JWT token received from the server after login/register.
 */
function setToken(token) {
  sessionStorage.setItem('token', token);
}

/**
 * Removes the JWT token from sessionStorage, effectively logging the user out
 * on the client side.
 */
function clearToken() {
  sessionStorage.removeItem('token');
}

/**
 * Core fetch wrapper that handles auth headers, JSON serialization, and error handling.
 *
 * If a token exists in sessionStorage it is attached as a Bearer Authorization header.
 * If the body is a plain object (not FormData), it is JSON-stringified and the
 * Content-Type header is set to application/json. FormData bodies are passed through
 * as-is so the browser can set the correct multipart boundary.
 *
 * @async
 * @param {string} path - The API path relative to API_BASE (e.g. '/auth/login').
 * @param {Object} [options={}] - Fetch options (method, body, headers, etc.).
 * @returns {Promise<Object>} The parsed JSON response body.
 * @throws {Error} Throws with the server-provided error message on non-2xx responses.
 */
async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  // Attach JWT token as Bearer auth when available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Auto-serialize plain objects to JSON; skip for FormData (file uploads)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

/**
 * Public API client object. Each method maps to a specific server REST endpoint.
 * Methods return the parsed JSON response from the server.
 *
 * @namespace api
 */
export const api = {
  // ---------------------------------------------------------------------------
  // Auth endpoints
  // ---------------------------------------------------------------------------

  /**
   * Registers a new user account.
   * @param {{ username: string, password: string, display_name: string }} body
   * @returns {Promise<{ token: string, user: Object }>}
   */
  register: (body) => request('/auth/register', { method: 'POST', body }),

  /**
   * Authenticates an existing user.
   * @param {{ username: string, password: string }} body
   * @returns {Promise<{ token: string, user: Object }>}
   */
  login: (body) => request('/auth/login', { method: 'POST', body }),

  /**
   * Fetches the currently authenticated user's profile.
   * @returns {Promise<{ user: Object }>}
   */
  me: () => request('/auth/me'),

  /**
   * Logs out the current user (server-side session invalidation).
   * @returns {Promise<Object>}
   */
  logout: () => request('/auth/logout', { method: 'POST' }),

  // ---------------------------------------------------------------------------
  // User profile endpoints
  // ---------------------------------------------------------------------------

  /**
   * Updates the authenticated user's profile (bio, location, gender, age).
   * @param {{ bio?: string, location?: string, gender?: string, age?: number }} body
   * @returns {Promise<Object>}
   */
  updateProfile: (body) => request('/users/profile', { method: 'PUT', body }),

  /**
   * Submits the user's childhood trauma response to be processed by the AI.
   * @param {{ trauma: string }} body
   * @returns {Promise<{ response: string }>} The AI-generated assessment.
   */
  submitTrauma: (body) => request('/users/trauma', { method: 'POST', body }),

  /**
   * Marks the user's onboarding as complete so they can access the lobby.
   * @returns {Promise<Object>}
   */
  completeOnboarding: () => request('/users/complete-onboarding', { method: 'POST' }),

  /**
   * Fetches the global points leaderboard.
   * @returns {Promise<{ users: Array<Object> }>}
   */
  leaderboard: () => request('/users/leaderboard'),

  /**
   * Fetches a specific user's public profile by ID.
   * @param {number|string} id - The user ID.
   * @returns {Promise<Object>}
   */
  getUser: (id) => request(`/users/${id}`),

  // ---------------------------------------------------------------------------
  // Upload endpoints
  // ---------------------------------------------------------------------------

  /**
   * Uploads a profile photo during onboarding.
   * @param {FormData} formData - Must contain a 'photo' file field.
   * @returns {Promise<{ url: string }>} The URL of the uploaded photo.
   */
  uploadProfilePhoto: (formData) => request('/upload/profile-photo', { method: 'POST', body: formData }),

  /**
   * Uploads a photo for the photo exchange feature during chat.
   * @param {FormData} formData - Must contain a 'photo' file field.
   * @returns {Promise<{ url: string }>} The URL of the uploaded photo.
   */
  uploadPhoto: (formData) => request('/upload/photo', { method: 'POST', body: formData }),

  /**
   * Uploads a voice note recording.
   * @param {FormData} formData - Must contain a 'voice' file field (audio/webm).
   * @returns {Promise<{ url: string }>} The URL of the uploaded voice note.
   */
  uploadVoice: (formData) => request('/upload/voice', { method: 'POST', body: formData }),

  // ---------------------------------------------------------------------------
  // Conversation endpoints
  // ---------------------------------------------------------------------------

  /**
   * Fetches all conversations for the authenticated user.
   * @returns {Promise<{ conversations: Array<Object> }>}
   */
  getConversations: () => request('/conversations'),

  /**
   * Fetches a single conversation with its messages.
   * @param {number|string} id - The conversation ID.
   * @returns {Promise<{ conversation: Object, messages: Array<Object> }>}
   */
  getConversation: (id) => request(`/conversations/${id}`),

  // ---------------------------------------------------------------------------
  // Points endpoints
  // ---------------------------------------------------------------------------

  /**
   * Fetches the authenticated user's point total and history log.
   * @returns {Promise<{ total: number, log: Array<Object> }>}
   */
  getPoints: () => request('/points'),
};

export { getToken, setToken, clearToken };
