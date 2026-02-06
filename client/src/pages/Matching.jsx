import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket, useSocketEvent } from '../hooks/useSocket';

export default function Matching() {
  const navigate = useNavigate();
  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      socket.emit('join-queue');
    }
    return () => {
      if (socket) {
        socket.emit('leave-queue');
      }
    };
  }, [socket]);

  const handleMatched = useCallback((data) => {
    navigate(`/chat/${data.conversationId}`, {
      state: { roomId: data.roomId, partner: data.partner },
    });
  }, [navigate]);

  useSocketEvent(socket, 'matched', handleMatched);

  return (
    <div className="matching">
      <div className="spinner" />
      <h2>Finding someone...</h2>
      <p style={{opacity:0.8,marginTop:8}}>Looking for a fellow trauma survivor</p>
      <button className="cancel-btn" onClick={() => navigate('/lobby')}>Cancel</button>
    </div>
  );
}
