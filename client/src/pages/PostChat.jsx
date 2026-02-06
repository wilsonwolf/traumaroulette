import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function PostChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [points, setPoints] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [pData, cData] = await Promise.all([
          api.getPoints(),
          api.getConversation(conversationId),
        ]);
        setPoints(pData);
        setConversation(cData.conversation);
        setMessageCount(cData.messages.length);
        refreshUser();
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [conversationId, refreshUser]);

  const convPoints = points?.log?.filter(
    l => String(l.conversation_id) === String(conversationId)
  ) || [];
  const totalEarned = convPoints.reduce((sum, l) => sum + l.points, 0);

  return (
    <div className="postchat">
      <div className="card">
        <h2>Conversation Complete</h2>

        {conversation?.is_friends_forever ? (
          <p style={{color:'var(--whatsapp-green)',fontWeight:700,fontSize:18,margin:'8px 0'}}>
            You made a friend forever!
          </p>
        ) : (
          <p style={{color:'var(--text-secondary)'}}>
            Until next time, stranger.
          </p>
        )}

        <div className="points-earned">+{totalEarned} pts</div>

        <div className="stats">
          <div>
            <div className="stat-value">{messageCount}</div>
            Messages
          </div>
          <div>
            <div className="stat-value">{conversation?.extensions_count || 0}</div>
            Extensions
          </div>
          <div>
            <div className="stat-value">{user?.total_points || 0}</div>
            Total Pts
          </div>
        </div>

        {convPoints.length > 0 && (
          <div style={{textAlign:'left',marginTop:16}}>
            <h4 style={{marginBottom:8,color:'var(--text-secondary)'}}>Points Breakdown</h4>
            {convPoints.map(l => (
              <div key={l.id} className="points-log-item">
                <span>{l.description}</span>
                <span className="points-amount">+{l.points}</span>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="btn-primary" onClick={() => navigate('/matching')}>Find Another</button>
          <button className="btn-outline" onClick={() => navigate('/lobby')}>Lobby</button>
        </div>
      </div>
    </div>
  );
}
