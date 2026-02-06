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
