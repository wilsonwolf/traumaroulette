/**
 * @file useSocket.jsx
 * @description Custom React hooks for Socket.io integration.
 *
 * Provides two hooks:
 *   - `useSocket()` -- connects to the server socket and returns the instance.
 *   - `useSocketEvent(socket, event, handler)` -- declaratively binds a socket
 *     event listener that is automatically cleaned up on unmount or when
 *     dependencies change.
 *
 * The socket connection is intentionally kept alive across React route
 * transitions (unmounts) so the user does not lose their connection when
 * navigating between pages.
 */

import { useEffect, useState } from 'react';
import { connectSocket } from '../socket';

/**
 * Hook that initialises and returns the shared Socket.io client instance.
 *
 * On mount it calls `connectSocket()` to establish the connection and stores
 * the socket in local state. A `connect` listener forces a re-render whenever
 * the socket reconnects (e.g. after a temporary network drop) so consuming
 * components always see the latest connected state.
 *
 * The cleanup function only removes the `connect` listener -- it does NOT
 * disconnect the socket, because the connection must survive page navigation.
 *
 * @returns {import('socket.io-client').Socket|null} The socket instance, or null before initialisation.
 */
export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    function onConnect() {
      // Force re-render if socket reconnects so consumers see updated state
      setSocket(s);
    }
    s.on('connect', onConnect);

    return () => {
      s.off('connect', onConnect);
      // Intentionally not disconnecting -- socket must persist across page navigations
    };
  }, []);

  return socket;
}

/**
 * Declarative hook for subscribing to a specific Socket.io event.
 *
 * Attaches the handler when the socket is available and removes it on cleanup
 * (component unmount or when socket/event/handler change). This pattern avoids
 * manual cleanup boilerplate in every component that listens to socket events.
 *
 * @param {import('socket.io-client').Socket|null} socket - The socket instance (from useSocket).
 * @param {string} event - The event name to listen for (e.g. 'new-message').
 * @param {Function} handler - Callback invoked when the event fires.
 */
export function useSocketEvent(socket, event, handler) {
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
