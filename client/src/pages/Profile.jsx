import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [pData, cData, lData] = await Promise.all([
          api.getPoints(),
          api.getConversations(),
          api.leaderboard(),
        ]);
        setPoints(pData);
        setConversations(cData.conversations);
        setLeaderboard(lData.users);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  return (
    <div className="profile-page">
      <div className="header">
        <h1>Profile</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/lobby')}>Lobby</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="profile-content">
        <div className="card">
          <div className="profile-header-card">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="Profile" />
            ) : (
              <div className="profile-avatar-placeholder">
                {user?.display_name?.[0]}
              </div>
            )}
            <div className="profile-info">
              <h2>{user?.display_name}</h2>
              <p>@{user?.username}</p>
              <span className="points-badge">{user?.total_points || 0} pts</span>
            </div>
          </div>

          {user?.bio && <p style={{color:'var(--text-secondary)',fontSize:14}}>{user.bio}</p>}
          <div style={{fontSize:13,color:'var(--text-secondary)',marginTop:4}}>
            {user?.location && <span>{user.location} | </span>}
            {user?.age && <span>{user.age}y | </span>}
            {user?.gender && <span>{user.gender}</span>}
          </div>
        </div>

        {points && points.log.length > 0 && (
          <div className="card points-breakdown">
            <h3>Points History</h3>
            {points.log.slice(0, 15).map(l => (
              <div key={l.id} className="points-log-item">
                <span>{l.description}</span>
                <span className="points-amount">+{l.points}</span>
              </div>
            ))}
          </div>
        )}

        {conversations.length > 0 && (
          <div className="card conversation-history">
            <h3>Conversations</h3>
            {conversations.map(c => (
              <div key={c.id} className="conv-item">
                <div>
                  <div className="conv-partner">{c.partner_name}</div>
                  <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                    {c.extensions_count} extensions
                  </div>
                </div>
                <span className={`conv-status ${c.is_friends_forever ? 'friends' : ''}`}>
                  {c.is_friends_forever ? 'Friends Forever' : c.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="card leaderboard">
            <h3>Leaderboard</h3>
            {leaderboard.map((u, i) => (
              <div key={u.id} className="leaderboard-item">
                <span className="rank">#{i + 1}</span>
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" />
                ) : (
                  <div style={{width:36,height:36,borderRadius:'50%',background:'#ddd',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>
                    {u.display_name[0]}
                  </div>
                )}
                <span className="lb-name">{u.display_name}</span>
                <span className="lb-points">{u.total_points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
