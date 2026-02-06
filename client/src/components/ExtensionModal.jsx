/**
 * @file ExtensionModal.jsx
 * @description Modal presented when the chat timer expires, allowing each user to
 * vote on what happens next.
 *
 * Three options are available:
 *   - "Extend (Photo Exchange)" -- both users exchange photos to earn more time
 *   - "Friends Forever" -- both users agree to remove the timer entirely
 *   - "Leave" -- the user wants to end the conversation
 *
 * Both users vote independently; the server resolves the outcome once both
 * votes are received (e.g. if either votes "leave" the chat closes).
 */

/**
 * Extension vote modal component.
 *
 * Renders a full-screen overlay with three voting buttons. The parent Chat
 * component passes the `onVote` callback which emits the vote via socket.
 *
 * @component
 * @param {Object} props
 * @param {(vote: 'extend'|'friends_forever'|'leave') => void} props.onVote -
 *   Callback invoked with the user's chosen vote option.
 * @returns {React.ReactElement} The extension modal overlay.
 */
export default function ExtensionModal({ onVote }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Time's Up!</h2>
        <p>Your 3 minutes are over. What do you want to do?</p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={() => onVote('extend')}>
            Extend (Photo Exchange)
          </button>
          <button className="friends-btn" onClick={() => onVote('friends_forever')}>
            Friends Forever
          </button>
          <button className="btn-danger" onClick={() => onVote('leave')}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
