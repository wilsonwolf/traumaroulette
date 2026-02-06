import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="lobby">
      <div className="header">
        <h1>TraumaChat</h1>
        <div className="header-actions">
          <span className="points-badge">{user?.total_points || 0} pts</span>
        </div>
      </div>
      <div className="lobby-content">
        <div>
          <h2 style={{fontSize:24,marginBottom:8}}>Ready to connect?</h2>
          <p style={{color:'var(--text-secondary)',maxWidth:300}}>
            You'll be paired with a random stranger for a 3-minute timed conversation. No pressure. Just trauma.
          </p>
        </div>
        <button className="find-btn" onClick={() => navigate('/matching')}>
          Find Someone
        </button>
      </div>
      <div className="lobby-nav">
        <button className="btn-outline" onClick={() => navigate('/profile')}>Profile</button>
        <button className="btn-outline" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
