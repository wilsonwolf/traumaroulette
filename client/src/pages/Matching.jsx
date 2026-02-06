/**
 * @file Matching.jsx
 * @description Queue/searching screen displayed while waiting for a chat partner.
 *
 * On mount, emits a `join-queue` socket event to enter the matchmaking pool.
 * When the server finds a partner it fires a `matched` event containing the
 * conversation ID, room ID, and partner info. The component then navigates to
 * the chat page with that data passed via route state.
 *
 * On unmount (including cancel), emits `leave-queue` to remove the user from
 * the matchmaking pool.
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket, useSocketEvent } from '../hooks/useSocket';

/**
 * Matching screen component with a loading spinner and cancel button.
 *
 * @component
 * @returns {React.ReactElement} The matching/searching UI.
 */
export default function Matching() {
  const navigate = useNavigate();
  const socket = useSocket();

  // Join the matchmaking queue on mount, leave on unmount
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

  /**
   * Handles the `matched` socket event by navigating to the chat page.
   * Passes roomId and partner data via React Router's location state so
   * the Chat component can immediately join the socket room without an
   * extra server round-trip.
   *
   * @param {{ conversationId: number, roomId: string, partner: Object }} data
   */
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
