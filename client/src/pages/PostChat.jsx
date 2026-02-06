/**
 * @file PostChat.jsx
 * @description Post-conversation summary page shown after a chat ends.
 *
 * Displays a recap of the completed conversation including:
 *   - Whether the users became "Friends Forever"
 *   - Points earned during the conversation (with a detailed breakdown)
 *   - Conversation statistics (message count, extension count, total points)
 *   - Navigation to start a new conversation or return to the lobby
 *
 * On mount, fetches the user's point log and the conversation details in
 * parallel, then refreshes the auth user object to reflect updated totals.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

/**
 * Post-chat summary page component.
 *
 * Reads `conversationId` from the URL params and loads conversation data +
 * point history from the API. Filters the point log to only show entries
 * relevant to this specific conversation.
 *
 * @component
 * @returns {React.ReactElement} The post-chat summary UI.
 */
export default function PostChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [points, setPoints] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messageCount, setMessageCount] = useState(0);

  // Fetch conversation data and point history on mount
  useEffect(() => {
    /**
     * Loads point data and conversation details in parallel.
     * Also refreshes the auth user to sync the total_points display.
     */
    async function load() {
      try {
        const [pData, cData] = await Promise.all([
          api.getPoints(),
          api.getConversation(conversationId),
        ]);
        setPoints(pData);
        setConversation(cData.conversation);
        setMessageCount(cData.messages.length);
        // Refresh user context so total_points is up-to-date
        refreshUser();
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [conversationId, refreshUser]);

  // Filter the full point log to only entries from this conversation
  const convPoints = points?.log?.filter(
    l => String(l.conversation_id) === String(conversationId)
  ) || [];
  // Sum up all points earned in this conversation
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
