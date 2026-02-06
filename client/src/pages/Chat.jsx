import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { useTimer } from '../hooks/useTimer';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { api } from '../api';
import ExtensionModal from '../components/ExtensionModal';
import PhotoExchangeModal from '../components/PhotoExchangeModal';
import FriendsForeverModal from '../components/FriendsForeverModal';

export default function Chat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const { secondsLeft, isWarning, startTimer, stopTimer } = useTimer();
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [partner, setPartner] = useState(location.state?.partner || null);
  const [roomId, setRoomId] = useState(location.state?.roomId || null);
  const [isFriendsForever, setIsFriendsForever] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [showPhotoExchange, setShowPhotoExchange] = useState(false);
  const [photoExchangeData, setPhotoExchangeData] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [showFriendsForever, setShowFriendsForever] = useState(false);
  const [extensionWaiting, setExtensionWaiting] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join room
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('join-room', roomId);
    }
  }, [socket, roomId]);

  // Socket events
  const handleNewMessage = useCallback((msg) => {
    if (String(msg.conversation_id) === String(conversationId)) {
      setMessages(prev => [...prev, msg]);
    }
  }, [conversationId]);

  const handleTimerStart = useCallback(({ endTime }) => {
    startTimer(endTime);
  }, [startTimer]);

  const handleTimerExpired = useCallback(() => {
    setShowExtension(true);
  }, []);

  const handleExtensionResult = useCallback(({ result }) => {
    setShowExtension(false);
    setExtensionWaiting(false);
    if (result === 'photo_exchange') {
      setShowPhotoExchange(true);
    } else if (result === 'friends_forever') {
      setShowFriendsForever(true);
      setIsFriendsForever(true);
      stopTimer();
    } else if (result === 'closed') {
      setChatClosed(true);
      stopTimer();
    }
  }, [stopTimer]);

  const handlePhotoReveal = useCallback(({ photos }) => {
    setPhotoExchangeData(photos);
    setShowRating(true);
  }, []);

  const handleFriendsForeverConfirmed = useCallback(() => {
    setShowFriendsForever(true);
    setIsFriendsForever(true);
    stopTimer();
  }, [stopTimer]);

  const handleConversationClosed = useCallback(({ reason }) => {
    setChatClosed(true);
    stopTimer();
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_type: 'system',
      content: reason || 'Conversation ended',
      created_at: new Date().toISOString(),
      sender_id: 0,
    }]);
  }, [stopTimer]);

  const handlePartnerDisconnected = useCallback(() => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_type: 'system',
      content: 'Partner disconnected. Waiting 30s for reconnect...',
      created_at: new Date().toISOString(),
      sender_id: 0,
    }]);
  }, []);

  const handleVoteReceived = useCallback(() => {
    setExtensionWaiting(true);
  }, []);

  const handleRejoin = useCallback((data) => {
    setRoomId(data.roomId);
    setPartner(prev => prev || { id: data.partnerId });
  }, []);

  useSocketEvent(socket, 'new-message', handleNewMessage);
  useSocketEvent(socket, 'timer-start', handleTimerStart);
  useSocketEvent(socket, 'timer-expired', handleTimerExpired);
  useSocketEvent(socket, 'extension-prompt', handleTimerExpired);
  useSocketEvent(socket, 'extension-result', handleExtensionResult);
  useSocketEvent(socket, 'photo-exchange-reveal', handlePhotoReveal);
  useSocketEvent(socket, 'friends-forever-confirmed', handleFriendsForeverConfirmed);
  useSocketEvent(socket, 'conversation-closed', handleConversationClosed);
  useSocketEvent(socket, 'partner-disconnected', handlePartnerDisconnected);
  useSocketEvent(socket, 'vote-received', handleVoteReceived);
  useSocketEvent(socket, 'rejoin-conversation', handleRejoin);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !socket || chatClosed) return;
    socket.emit('send-message', { conversationId: parseInt(conversationId), content: input.trim() });
    setInput('');
  }

  async function handleVoiceStop() {
    const result = await stopRecording();
    if (!result) return;
    const formData = new FormData();
    formData.append('voice', result.blob, 'voice.webm');
    try {
      const data = await api.uploadVoice(formData);
      socket.emit('send-voice-note', {
        conversationId: parseInt(conversationId),
        voiceUrl: data.url,
        duration: result.duration,
      });
    } catch (err) {
      console.error('Voice upload failed:', err);
    }
  }

  function handleExtensionVote(vote) {
    socket.emit('extension-vote', { conversationId: parseInt(conversationId), vote });
    setExtensionWaiting(true);
  }

  async function handlePhotoSubmit(file) {
    const formData = new FormData();
    formData.append('photo', file);
    const data = await api.uploadPhoto(formData);
    socket.emit('photo-exchange-submit', {
      conversationId: parseInt(conversationId),
      photoUrl: data.url,
    });
  }

  function handleRatingSubmit(score) {
    socket.emit('rate-photo', { conversationId: parseInt(conversationId), score });
    setShowRating(false);
    setShowPhotoExchange(false);
    setPhotoExchangeData(null);
  }

  function formatTime(seconds) {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatMsgTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="partner-avatar">
          {partner?.photo_url
            ? <img src={partner.photo_url} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} />
            : (partner?.display_name?.[0] || '?')
          }
        </div>
        <div className="partner-info">
          <div className="partner-name">{partner?.display_name || 'Stranger'}</div>
          <div className="partner-status">
            {chatClosed ? 'Disconnected' : isFriendsForever ? 'Friends Forever' : 'Connected'}
          </div>
        </div>
        {isFriendsForever ? (
          <div className="timer-display friends">FOREVER</div>
        ) : secondsLeft !== null ? (
          <div className={`timer-display ${isWarning ? 'warning' : ''}`}>
            {formatTime(secondsLeft)}
          </div>
        ) : null}
      </div>

      <div className="messages-container">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message-bubble ${
              msg.message_type === 'system' ? 'system' :
              msg.sender_id === user.id ? 'sent' : 'received'
            }`}
          >
            {msg.message_type === 'voice' ? (
              <div className="voice-note">
                <audio controls src={msg.voice_url} style={{height:32,width:'100%'}} />
                <span className="voice-duration">{msg.voice_duration}s</span>
              </div>
            ) : (
              <div>{msg.content}</div>
            )}
            {msg.message_type !== 'system' && (
              <div className="message-time">{formatMsgTime(msg.created_at)}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!chatClosed && (
        <div className="chat-input-area">
          {isRecording ? (
            <>
              <div className="recording-indicator">
                <span>Recording: {duration}s</span>
                <button className="cancel-record" onClick={cancelRecording}>Cancel</button>
              </div>
              <button className="voice-btn recording" onClick={handleVoiceStop}>
                Stop
              </button>
            </>
          ) : (
            <>
              <button className="voice-btn" onMouseDown={startRecording}>
                Mic
              </button>
              <form onSubmit={sendMessage} style={{display:'flex',flex:1,gap:8}}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message..."
                />
                <button className="send-btn" type="submit" disabled={!input.trim()}>
                  &gt;
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {chatClosed && (
        <div style={{padding:16,textAlign:'center',background:'white'}}>
          <button className="btn-primary" onClick={() => navigate(`/postchat/${conversationId}`)}>
            View Summary
          </button>
          <button className="btn-outline" onClick={() => navigate('/lobby')} style={{marginLeft:8}}>
            Back to Lobby
          </button>
        </div>
      )}

      {showExtension && !extensionWaiting && (
        <ExtensionModal onVote={handleExtensionVote} />
      )}

      {showExtension && extensionWaiting && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Waiting...</h2>
            <p>Waiting for your partner to decide...</p>
          </div>
        </div>
      )}

      {showPhotoExchange && !photoExchangeData && !showRating && (
        <PhotoExchangeModal
          onSubmit={handlePhotoSubmit}
          photos={null}
          onRate={null}
        />
      )}

      {showRating && photoExchangeData && (
        <PhotoExchangeModal
          onSubmit={null}
          photos={photoExchangeData}
          onRate={handleRatingSubmit}
          currentUserId={user.id}
        />
      )}

      {showFriendsForever && (
        <FriendsForeverModal onClose={() => setShowFriendsForever(false)} />
      )}
    </div>
  );
}
