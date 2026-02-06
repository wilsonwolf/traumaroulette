/**
 * @file FriendsForeverModal.jsx
 * @description Celebration modal shown when both users vote "Friends Forever".
 *
 * This modal is a purely presentational overlay that announces the mutual
 * "Friends Forever" decision. When both users choose this option the server
 * removes the conversation timer and awards +100 bonus points to each user.
 * Dismissing the modal returns the user to the now-unlimited chat.
 */

/**
 * Friends Forever celebration modal component.
 *
 * Displays a celebratory message and a "Keep Chatting" button that dismisses
 * the overlay. The parent Chat component handles the dismiss via `onClose`.
 *
 * @component
 * @param {Object} props
 * @param {() => void} props.onClose - Callback to dismiss the modal and return to chat.
 * @returns {React.ReactElement} The celebration modal overlay.
 */
export default function FriendsForeverModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal friends-forever-modal">
        <div className="friends-forever-celebrate">&#127881;&#127881;&#127881;</div>
        <h2>Friends Forever!</h2>
        <p>You both chose each other. The timer is gone. Chat as long as you want. +100 bonus points!</p>
        <button
          className="btn-primary"
          onClick={onClose}
          style={{ width: '100%', background: 'white', color: '#764ba2', fontWeight: 700 }}
        >
          Keep Chatting
        </button>
      </div>
    </div>
  );
}
