/**
 * @file socket.js
 * @description Socket.io client singleton module.
 *
 * Manages a single shared Socket.io connection to the server. The singleton
 * pattern ensures that all components share the same socket instance, preventing
 * duplicate connections. The socket authenticates using the JWT token from
 * sessionStorage via the `auth` handshake option.
 *
 * Usage flow:
 *   1. `connectSocket()` -- creates (if needed) and connects the socket
 *   2. Components use the returned socket to emit/listen for events
 *   3. `disconnectSocket()` -- tears down the connection on logout
 */

import { io } from 'socket.io-client';
import { getToken } from './api';

/**
 * Module-level singleton reference. Null when no socket has been created yet
 * or after `disconnectSocket()` has been called.
 * @type {import('socket.io-client').Socket|null}
 */
let socket = null;

/**
 * Returns the existing socket instance or lazily creates a new one.
 *
 * The socket is created with `autoConnect: false` so the caller controls
 * when the connection is actually established (via `connectSocket`).
 *
 * @returns {import('socket.io-client').Socket} The singleton socket instance.
 */
export function getSocket() {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      auth: {
        token: getToken(),
      },
    });
  }
  return socket;
}

/**
 * Ensures the socket is created, authenticated with the latest JWT token,
 * and connected to the server.
 *
 * Re-setting `s.auth` on every call guarantees the freshest token is used,
 * which matters after login/register when the token was just stored.
 *
 * @returns {import('socket.io-client').Socket} The connected socket instance.
 */
export function connectSocket() {
  const s = getSocket();
  // Always refresh the auth token before connecting in case it changed
  s.auth = { token: getToken() };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Disconnects and destroys the singleton socket instance.
 *
 * After calling this, `getSocket()` will create a fresh instance on the
 * next invocation. Typically called during logout.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
