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
