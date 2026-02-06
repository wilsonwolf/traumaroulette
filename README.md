# TraumaChat

A real-time chat roulette web app that pairs strangers for 3-minute timed conversations, featuring a darkly humorous onboarding flow with a mock Slavic therapist, an extension/photo-exchange mechanic, and a gamification points system.

> **Built with:** React (Vite) · Express · Socket.io · SQLite

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
  - [Onboarding](#onboarding)
  - [Matchmaking & Chat](#matchmaking--chat)
  - [Timer & Extension Flow](#timer--extension-flow)
  - [Points System](#points-system)
  - [Voice Notes](#voice-notes)
- [Database Schema](#database-schema)
- [Socket.io Events Reference](#socketio-events-reference)
- [API Endpoints](#api-endpoints)
- [Development Notes](#development-notes)

---

## Features

- **Anonymous Matchmaking** — Join a queue, get paired with a random stranger instantly
- **3-Minute Timed Conversations** — Server-authoritative countdown timer with 30-second warning
- **Extension Voting** — When time's up, both users choose: Extend, Leave, or Friends Forever
- **Photo Exchange** — On extension, both upload a photo revealed simultaneously, then rate 1-5 stars
- **Friends Forever** — If both choose it, the timer is removed and you chat indefinitely (+100 bonus points)
- **Voice Notes** — Press-and-hold to record (up to 60s), release to send, slide to cancel
- **Mock Slavic Therapist** — Dr. Slavenko delivers keyword-matched impolite assessments during onboarding
- **Points & Leaderboard** — Earn points for participation, extensions, ratings, streaks, and friendship
- **WhatsApp-Style UI** — Dark green header, light green sent bubbles, familiar chat layout
- **Disconnect Handling** — 30-second grace period for reconnection before closing the conversation

## Architecture

For detailed architecture diagrams (system overview, state machines, sequence diagrams), see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

High-level overview:

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   React Client (:5173)  │◄──────►│  Express Server (:3001)  │
│                         │  HTTP   │                          │
│  • Pages (7)            │  + WS   │  • REST Routes (5)       │
│  • Hooks (4)            │         │  • Socket Handlers (7)   │
│  • Components (3)       │         │  • Services (5)          │
└─────────────────────────┘         └────────────┬────────────┘
                                                  │
                                    ┌─────────────┴────────────┐
                                    │   SQLite + Filesystem     │
                                    │   • 7 tables              │
                                    │   • uploads/photos/       │
                                    │   • uploads/voice/        │
                                    └──────────────────────────┘
```

## Project Structure

```
funproject/
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── api.js                   # REST API wrapper + sessionStorage token management
│       ├── socket.js                # Socket.io client singleton
│       ├── App.jsx                  # Router, AuthProvider, ProtectedRoute
│       ├── App.css                  # All component styles (WhatsApp theme)
│       ├── index.css                # Global styles + CSS variables
│       ├── pages/
│       │   ├── Landing.jsx          # Login / Register form
│       │   ├── Onboarding.jsx       # 5-step wizard (account→photo→demographics→trauma→confirm)
│       │   ├── Lobby.jsx            # "Find Someone" button
│       │   ├── Matching.jsx         # Queue spinner, emits join-queue
│       │   ├── Chat.jsx             # Main chat: messages, timer, modals, voice
│       │   ├── PostChat.jsx         # Conversation summary + points breakdown
│       │   └── Profile.jsx          # User profile, points history, leaderboard
│       ├── components/
│       │   ├── ExtensionModal.jsx   # Extend / Leave / Friends Forever vote
│       │   ├── PhotoExchangeModal.jsx # Photo upload, reveal, and star rating
│       │   └── FriendsForeverModal.jsx # Celebration modal
│       └── hooks/
│           ├── useAuth.jsx          # AuthContext provider + useAuth hook
│           ├── useSocket.jsx        # Socket connection + useSocketEvent
│           ├── useTimer.jsx         # Client-side countdown from server endTime
│           └── useVoiceRecorder.jsx # MediaRecorder API (record/stop/cancel)
│
├── server/
│   ├── index.js                     # Express + Socket.io server entry point
│   ├── db/
│   │   └── init.js                  # SQLite schema initialization (7 tables)
│   ├── routes/
│   │   ├── auth.js                  # POST /register, /login, /logout; GET /me
│   │   ├── users.js                 # PUT /profile, POST /trauma, /complete-onboarding
│   │   ├── upload.js                # POST /photo, /profile-photo, /voice (multer)
│   │   ├── conversations.js         # GET / (list), GET /:id (detail + messages)
│   │   └── points.js               # GET / (total + log)
│   ├── services/
│   │   ├── matchmaker.js            # In-memory queue, user↔socket mapping, pairing
│   │   ├── conversation.js          # Conversation CRUD + lifecycle transitions
│   │   ├── timer.js                 # Server-side setTimeout per room
│   │   ├── points.js                # Point award functions with streak logic
│   │   └── trauma.js               # Keyword-matched Slavic therapist responses
│   ├── socket/
│   │   └── handlers/
│   │       └── index.js             # All Socket.io event handlers (the core state machine)
│   └── middleware/
│       ├── session.js               # In-memory token→userId map + auth middleware
│       └── upload.js                # Multer config for photos and voice files
│
├── shared/
│   └── constants.js                 # Timer, points, events, statuses (shared by client & server)
│
├── uploads/                         # User-uploaded files (gitignored)
│   ├── photos/
│   └── voice/
│
├── ARCHITECTURE.md                  # Mermaid architecture diagrams
└── .gitignore
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/wilsonwolf/traumaroulette.git
cd traumaroulette

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Running

Open **two terminal windows**:

```bash
# Terminal 1 — Start the server
cd server
DEV_TIMER_SECONDS=15 node index.js
# Server runs on http://localhost:3001
```

```bash
# Terminal 2 — Start the client
cd client
npm run dev
# Client runs on http://localhost:5173
```

### Testing the Full Flow

1. Open **two separate browser windows** (not tabs — `sessionStorage` is per-tab for independent sessions)
2. Register a different user in each window
3. Complete the 5-step onboarding in both (enjoy Dr. Slavenko's assessment)
4. Both click **"Find Someone"** — they'll be matched
5. Chat back and forth — messages appear in real-time
6. Wait for the timer to expire (15 seconds with `DEV_TIMER_SECONDS=15`)
7. Both vote to **Extend** — upload photos → rate each other → new timer starts
8. On the next expiry, both vote **"Friends Forever"** — timer removed, +100 points
9. Check the Profile page for points breakdown and leaderboard

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DEV_TIMER_SECONDS` | `180` | Conversation timer duration in seconds. Set to `15` for rapid testing. |
| `PORT` | `3001` | Server listen port |

## How It Works

### Onboarding

Five sequential steps, each validated before proceeding:

| Step | Name | What Happens |
|------|------|-------------|
| 1 | **Account** | Display name, username, password (created at registration) |
| 2 | **Photo** | Required profile photo upload via multer |
| 3 | **Demographics** | Bio (200 char max), location, gender, age (21-50 enforced) |
| 4 | **Trauma** | User describes childhood trauma → Dr. Slavenko responds with a keyword-matched impolite Slavic assessment |
| 5 | **Confirm** | Summary review → "Enter the Lobby" |

**Dr. Slavenko** matches against 7 keyword categories (parents, abandonment, school, siblings, poverty, emotional, denial) with 3+ responses each, plus 5 default responses for unmatched input.

### Matchmaking & Chat

- Users join a server-side in-memory queue via Socket.io
- When 2+ users are queued, the server pairs them, creates a conversation room, and notifies both
- Both users join the same Socket.io room for real-time message delivery
- Messages are persisted to SQLite and broadcast to the room

### Timer & Extension Flow

```
Match → 3-min timer → Timer expires → Extension vote
                                         ├── Either votes "Leave" → Conversation closed
                                         ├── Both vote "Friends Forever" → Permanent chat + 100 pts
                                         └── Otherwise → Photo exchange → Rating → New 3-min timer → Repeat
```

The timer is **server-authoritative**: the server runs `setTimeout` and emits events. The client runs a local interval synced to the server's `endTime` for smooth display.

### Points System

| Event | Points |
|-------|--------|
| Matched with someone | +10 |
| Each extension agreed | +25 |
| Streak bonus (3+ extensions) | +10 extra per extension |
| Rated by partner | score × 5 (5-25 pts) |
| Friends Forever | +100 |

### Voice Notes

- Uses the browser's **MediaRecorder API** (audio/webm)
- Press the mic button to start recording, click Stop to finish
- Audio blob is uploaded to the server via multer, stored in `uploads/voice/`
- A Socket.io event delivers the voice URL to the partner
- Playback via HTML5 `<audio>` element
- Max duration: 60 seconds (auto-stops)

## Database Schema

Seven tables in SQLite (`traumachat.db`, created automatically on first run):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts + profiles | username, password_hash, display_name, photo_url, bio, location, gender, age, childhood_trauma, trauma_response, total_points, onboarding_complete |
| `conversations` | Chat sessions between two users | user1_id, user2_id, room_id, status, extensions_count, is_friends_forever, current_timer_end |
| `messages` | All chat messages | conversation_id, sender_id, message_type (text/voice/system), content, voice_url, voice_duration |
| `extension_votes` | Extension round votes | conversation_id, user_id, round, vote (extend/leave/friends_forever) |
| `photo_exchanges` | Photos submitted during exchange | conversation_id, sender_id, photo_url |
| `ratings` | Star ratings after photo reveal | conversation_id, rater_id, rated_id, score (1-5) |
| `points_log` | Audit trail for all points awarded | user_id, conversation_id, event_type, points, description |

## Socket.io Events Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-queue` | — | Enter the matchmaking queue |
| `leave-queue` | — | Leave the queue |
| `join-room` | `roomId` | Join a conversation room (reconnect) |
| `send-message` | `{ conversationId, content }` | Send a text message |
| `send-voice-note` | `{ conversationId, voiceUrl, duration }` | Send a voice note |
| `extension-vote` | `{ conversationId, vote }` | Submit extension vote (`extend`/`leave`/`friends_forever`) |
| `photo-exchange-submit` | `{ conversationId, photoUrl }` | Submit photo for exchange |
| `rate-photo` | `{ conversationId, score }` | Rate partner's photo (1-5) |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `matched` | `{ conversationId, roomId, partner }` | You've been matched |
| `new-message` | Full message object | New message in conversation |
| `timer-start` | `{ duration, endTime }` | Timer has started |
| `timer-warning` | `{ secondsLeft }` | 30 seconds remaining |
| `timer-expired` | `{ conversationId }` | Timer reached zero |
| `extension-prompt` | `{ conversationId }` | Vote now |
| `extension-result` | `{ result, conversationId }` | Vote outcome |
| `photo-exchange-start` | `{ conversationId }` | Upload your photo |
| `photo-exchange-reveal` | `{ conversationId, photos[] }` | Both photos ready |
| `rating-received` | `{ score, raterId }` | You were rated |
| `friends-forever-confirmed` | `{ conversationId }` | Permanent friends |
| `partner-disconnected` | `{ conversationId }` | Partner left |
| `conversation-closed` | `{ conversationId, reason }` | Chat ended |
| `vote-received` | `{ waiting }` | Your vote was recorded, waiting for partner |
| `rejoin-conversation` | `{ conversationId, roomId, status, partnerId }` | Reconnected to active conversation |

## API Endpoints

All endpoints are prefixed with `/api`. Authentication via `Authorization: Bearer <token>` header.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account (username, password, display_name) |
| POST | `/auth/login` | No | Log in (username, password) → token |
| GET | `/auth/me` | Yes | Get current user profile |
| POST | `/auth/logout` | Yes | Invalidate session |
| PUT | `/users/profile` | Yes | Update bio, location, gender, age |
| POST | `/users/trauma` | Yes | Submit trauma text → get Dr. Slavenko response |
| POST | `/users/complete-onboarding` | Yes | Mark onboarding as done |
| GET | `/users/leaderboard` | Yes | Top 20 users by points |
| GET | `/users/:id` | Yes | Get user's public profile |
| POST | `/upload/profile-photo` | Yes | Upload profile photo (multipart) |
| POST | `/upload/photo` | Yes | Upload exchange photo (multipart) |
| POST | `/upload/voice` | Yes | Upload voice note (multipart) |
| GET | `/conversations` | Yes | List user's conversations |
| GET | `/conversations/:id` | Yes | Get conversation detail + messages |
| GET | `/points` | Yes | Get total points + points log |

## Development Notes

- **Session storage**: Uses `sessionStorage` (not `localStorage`) so each browser tab maintains an independent session — essential for testing with two users simultaneously
- **In-memory state**: Sessions, matchmaking queue, active timers, pending votes, and pending ratings are all stored in server memory. A server restart clears all active sessions and conversations.
- **SQLite WAL mode**: The database uses Write-Ahead Logging for better concurrent read performance. This creates `.db-wal` and `.db-shm` sidecar files. To fully reset, delete all three: `rm -f traumachat.db*`
- **No StrictMode**: React StrictMode is disabled in `main.jsx` to prevent double-mounting of Socket.io connections during development
- **Vite proxy**: The dev server proxies `/api`, `/uploads`, and `/socket.io` (including WebSocket upgrade) to the Express server on port 3001

---

*Built with questionable therapeutic ethics and excellent taste in Eastern European humor.*
