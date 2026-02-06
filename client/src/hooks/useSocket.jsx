import { useEffect, useState } from 'react';
import { connectSocket } from '../socket';

export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    function onConnect() {
      // Force re-render if socket reconnects
      setSocket(s);
    }
    s.on('connect', onConnect);

    return () => {
      s.off('connect', onConnect);
      // Don't disconnect on unmount - keep alive for navigation
    };
  }, []);

  return socket;
}

export function useSocketEvent(socket, event, handler) {
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, event, handler]);
}
