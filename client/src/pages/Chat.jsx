/**
 * @file Chat.jsx
 * @description Main real-time chat page -- the core experience of TraumaChat.
 *
 * This is the most complex component in the application. It orchestrates:
 *   - Real-time messaging via Socket.io (text + voice notes)
 *   - A countdown timer driven by server-provided end timestamps
 *   - Voice recording through the MediaRecorder API
 *   - Multiple modal flows: extension voting, photo exchange, friends forever
 *   - Partner connection/disconnection handling
 *   - Post-chat navigation
 *
 * Socket event flow:
 *   Server -> Client:
 *     'new-message'            -> Append message to chat
 *     'timer-start'            -> Start/restart the countdown timer
 *     'timer-expired'          -> Show the extension vote modal
 *     'extension-prompt'       -> Same as timer-expired (alternative event)
 *     'extension-result'       -> Handle the resolved vote outcome
 *     'photo-exchange-reveal'  -> Show both photos for rating
 *     'friends-forever-confirmed' -> Show celebration modal
 *     'conversation-closed'    -> Mark chat as ended
 *     'partner-disconnected'   -> Show disconnection notice
 *     'vote-received'          -> Show "waiting for partner" state
 *     'rejoin-conversation'    -> Restore room/partner on reconnect
 *
 *   Client -> Server:
 *     'join-room'              -> Join the socket room for this conversation
 *     'send-message'           -> Send a text message
 *     'send-voice-note'        -> Send a voice note (after uploading the file)
 *     'extension-vote'         -> Submit the user's extension vote
 *     'photo-exchange-submit'  -> Submit the user's photo for exchange
 *     'rate-photo'             -> Submit a star rating for the partner's photo
 */

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

/**
 * Chat page component.
 *
 * Reads the `conversationId` from the URL params and the `roomId`/`partner`
 * from React Router location state (passed by the Matching page). Manages
 * all real-time chat state including messages, timer, modals, and voice recording.
 *
 * @component
 * @returns {React.ReactElement} The full chat interface.
 */
export default function Chat() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const { secondsLeft, isWarning, startTimer, stopTimer } = useTimer();
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // ---------------------------------------------------------------------------
  // State: messages and input
  // ---------------------------------------------------------------------------
  /** @type {[Array<Object>, Function]} Array of message objects from the server */
  const [messages, setMessages] = useState([]);
  /** @type {[string, Function]} Current text input value */
  const [input, setInput] = useState('');

  // ---------------------------------------------------------------------------
  // State: partner and room (initialised from route state, updated on rejoin)
  // ---------------------------------------------------------------------------
  const [partner, setPartner] = useState(location.state?.partner || null);
  const [roomId, setRoomId] = useState(location.state?.roomId || null);

  // ---------------------------------------------------------------------------
  // State: modal visibility and feature flags
  // ---------------------------------------------------------------------------
  /** Whether the conversation is in unlimited "friends forever" mode */
  const [isFriendsForever, setIsFriendsForever] = useState(false);
  /** Whether to show the extension vote modal */
  const [showExtension, setShowExtension] = useState(false);
  /** Whether to show the photo exchange upload modal */
  const [showPhotoExchange, setShowPhotoExchange] = useState(false);
  /** Photos data for the reveal stage of photo exchange */
  const [photoExchangeData, setPhotoExchangeData] = useState(null);
  /** Whether to show the photo rating UI */
  const [showRating, setShowRating] = useState(false);
  /** Whether to show the friends forever celebration modal */
  const [showFriendsForever, setShowFriendsForever] = useState(false);
  /** Whether we are waiting for the partner's extension vote */
  const [extensionWaiting, setExtensionWaiting] = useState(false);
  /** Whether the conversation has been closed (disables input) */
  const [chatClosed, setChatClosed] = useState(false);

  /** Ref used as a scroll anchor at the bottom of the messages list */
  const messagesEndRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Auto-scroll to bottom whenever a new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join the socket room when the socket and roomId are available
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('join-room', roomId);
    }
  }, [socket, roomId]);

  // ---------------------------------------------------------------------------
  // Socket event handlers
  // ---------------------------------------------------------------------------

  /**
   * Handles incoming messages. Only appends the message if it belongs to
   * the current conversation (guards against stale events from previous chats).
   * @param {Object} msg - The message object from the server.
   */
  const handleNewMessage = useCallback((msg) => {
    if (String(msg.conversation_id) === String(conversationId)) {
      setMessages(prev => [...prev, msg]);
    }
  }, [conversationId]);

  /**
   * Handles the server's timer-start event by starting the client-side countdown.
   * @param {{ endTime: string }} param0 - Absolute ISO timestamp when the timer expires.
   */
  const handleTimerStart = useCallback(({ endTime }) => {
    startTimer(endTime);
  }, [startTimer]);

  /**
   * Handles timer expiration by showing the extension vote modal.
   * Also used for the 'extension-prompt' event (same behavior).
   */
  const handleTimerExpired = useCallback(() => {
    setShowExtension(true);
  }, []);

  /**
   * Processes the server's resolved extension vote outcome.
   *
   * Possible results:
   *   - 'photo_exchange': both voted to extend -- show photo upload modal
   *   - 'friends_forever': both voted friends forever -- show celebration
   *   - 'closed': at least one user voted to leave -- end the chat
   *
   * @param {{ result: 'photo_exchange'|'friends_forever'|'closed' }} param0
   */
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

  /**
   * Handles the photo exchange reveal event. Receives both users' photo data
   * and transitions the modal to rating mode.
   * @param {{ photos: Array<{ userId: number, photoUrl: string }> }} param0
   */
  const handlePhotoReveal = useCallback(({ photos }) => {
    setPhotoExchangeData(photos);
    setShowRating(true);
  }, []);

  /**
   * Handles the friends-forever confirmation event (triggered when both users
   * vote friends_forever via a different code path than extension-result).
   */
  const handleFriendsForeverConfirmed = useCallback(() => {
    setShowFriendsForever(true);
    setIsFriendsForever(true);
    stopTimer();
  }, [stopTimer]);

  /**
   * Handles the conversation-closed event. Stops the timer and appends a
   * system message explaining the closure reason.
   * @param {{ reason?: string }} param0 - Optional reason text from the server.
   */
  const handleConversationClosed = useCallback(({ reason }) => {
    setChatClosed(true);
    stopTimer();
    // Inject a client-side system message to inform the user
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_type: 'system',
      content: reason || 'Conversation ended',
      created_at: new Date().toISOString(),
      sender_id: 0,
    }]);
  }, [stopTimer]);

  /**
   * Handles partner disconnection by showing a system message. The server
   * allows a 30-second window for reconnection before closing.
   */
  const handlePartnerDisconnected = useCallback(() => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      message_type: 'system',
      content: 'Partner disconnected. Waiting 30s for reconnect...',
      created_at: new Date().toISOString(),
      sender_id: 0,
    }]);
  }, []);

  /**
   * Handles the notification that the partner has submitted their vote.
   * Transitions the extension modal to a "waiting" state.
   */
  const handleVoteReceived = useCallback(() => {
    setExtensionWaiting(true);
  }, []);

  /**
   * Handles conversation rejoin after a reconnection. Restores the roomId
   * and partner info if they were lost during the disconnection.
   * @param {{ roomId: string, partnerId: number }} data
   */
  const handleRejoin = useCallback((data) => {
    setRoomId(data.roomId);
    // Only set partner if not already known (preserve richer data from initial match)
    setPartner(prev => prev || { id: data.partnerId });
  }, []);

  // -- Register all socket event listeners --
  useSocketEvent(socket, 'new-message', handleNewMessage);
  useSocketEvent(socket, 'timer-start', handleTimerStart);
  useSocketEvent(socket, 'timer-expired', handleTimerExpired);
  useSocketEvent(socket, 'extension-prompt', handleTimerExpired); // Alias for timer-expired
  useSocketEvent(socket, 'extension-result', handleExtensionResult);
  useSocketEvent(socket, 'photo-exchange-reveal', handlePhotoReveal);
  useSocketEvent(socket, 'friends-forever-confirmed', handleFriendsForeverConfirmed);
  useSocketEvent(socket, 'conversation-closed', handleConversationClosed);
  useSocketEvent(socket, 'partner-disconnected', handlePartnerDisconnected);
  useSocketEvent(socket, 'vote-received', handleVoteReceived);
  useSocketEvent(socket, 'rejoin-conversation', handleRejoin);

  // ---------------------------------------------------------------------------
  // User action handlers
  // ---------------------------------------------------------------------------

  /**
   * Sends a text message via socket. Guards against empty input, missing
   * socket, or a closed chat.
   * @param {React.FormEvent<HTMLFormElement>} e - The form submit event.
   */
  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !socket || chatClosed) return;
    socket.emit('send-message', { conversationId: parseInt(conversationId), content: input.trim() });
    setInput('');
  }

  /**
   * Stops the voice recording, uploads the resulting blob to the server,
   * and emits a voice note message via socket with the returned URL.
   */
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

  /**
   * Submits the user's extension vote and transitions to the waiting state.
   * @param {'extend'|'friends_forever'|'leave'} vote - The user's chosen option.
   */
  function handleExtensionVote(vote) {
    socket.emit('extension-vote', { conversationId: parseInt(conversationId), vote });
    setExtensionWaiting(true);
  }

  /**
   * Uploads the user's photo for the photo exchange and submits the URL
   * to the server via socket.
   * @param {File} file - The photo file selected by the user.
   */
  async function handlePhotoSubmit(file) {
    const formData = new FormData();
    formData.append('photo', file);
    const data = await api.uploadPhoto(formData);
    socket.emit('photo-exchange-submit', {
      conversationId: parseInt(conversationId),
      photoUrl: data.url,
    });
  }

  /**
   * Submits the user's star rating for the partner's photo and closes
   * all photo exchange modals.
   * @param {number} score - The 1-5 star rating.
   */
  function handleRatingSubmit(score) {
    socket.emit('rate-photo', { conversationId: parseInt(conversationId), score });
    setShowRating(false);
    setShowPhotoExchange(false);
    setPhotoExchangeData(null);
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  /**
   * Formats a number of seconds into a "M:SS" countdown string.
   * @param {number|null} seconds - Seconds remaining, or null for no active timer.
   * @returns {string} Formatted time string (e.g. "2:45") or "--:--" if null.
   */
  function formatTime(seconds) {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Formats an ISO timestamp into a short "HH:MM" time string for message display.
   * @param {string} ts - ISO 8601 timestamp.
   * @returns {string} Locale-formatted time (e.g. "14:32").
   */
  function formatMsgTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="chat-page">
      {/* -- Header: partner info + timer -- */}
      <div className="chat-header">
        <div className="partner-avatar">
          {/* Show partner photo or first letter of their name as fallback */}
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
        {/* Timer display: "FOREVER" when friends, countdown when timed, hidden otherwise */}
        {isFriendsForever ? (
          <div className="timer-display friends">FOREVER</div>
        ) : secondsLeft !== null ? (
          <div className={`timer-display ${isWarning ? 'warning' : ''}`}>
            {formatTime(secondsLeft)}
          </div>
        ) : null}
      </div>

      {/* -- Messages list -- */}
      <div className="messages-container">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message-bubble ${
              // Three bubble styles: system (centered), sent (right), received (left)
              msg.message_type === 'system' ? 'system' :
              msg.sender_id === user.id ? 'sent' : 'received'
            }`}
          >
            {/* Voice messages render an audio player; text/system messages render content */}
            {msg.message_type === 'voice' ? (
              <div className="voice-note">
                <audio controls src={msg.voice_url} style={{height:32,width:'100%'}} />
                <span className="voice-duration">{msg.voice_duration}s</span>
              </div>
            ) : (
              <div>{msg.content}</div>
            )}
            {/* Timestamp is hidden for system messages */}
            {msg.message_type !== 'system' && (
              <div className="message-time">{formatMsgTime(msg.created_at)}</div>
            )}
          </div>
        ))}
        {/* Invisible anchor element for auto-scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* -- Input area: text input + voice recording (hidden when chat is closed) -- */}
      {!chatClosed && (
        <div className="chat-input-area">
          {isRecording ? (
            /* Voice recording UI: shows elapsed duration, cancel + stop buttons */
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
            /* Default input UI: mic button + text input + send button */
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

      {/* -- Post-close navigation bar -- */}
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

      {/* -- Modal layer: only one modal is shown at a time -- */}

      {/* Extension vote modal (user has not voted yet) */}
      {showExtension && !extensionWaiting && (
        <ExtensionModal onVote={handleExtensionVote} />
      )}

      {/* Extension waiting modal (user voted, waiting for partner) */}
      {showExtension && extensionWaiting && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Waiting...</h2>
            <p>Waiting for your partner to decide...</p>
          </div>
        </div>
      )}

      {/* Photo exchange: upload mode (no photos revealed yet) */}
      {showPhotoExchange && !photoExchangeData && !showRating && (
        <PhotoExchangeModal
          onSubmit={handlePhotoSubmit}
          photos={null}
          onRate={null}
        />
      )}

      {/* Photo exchange: rating mode (both photos revealed) */}
      {showRating && photoExchangeData && (
        <PhotoExchangeModal
          onSubmit={null}
          photos={photoExchangeData}
          onRate={handleRatingSubmit}
          currentUserId={user.id}
        />
      )}

      {/* Friends forever celebration modal */}
      {showFriendsForever && (
        <FriendsForeverModal onClose={() => setShowFriendsForever(false)} />
      )}
    </div>
  );
}
