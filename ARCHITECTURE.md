# TraumaChat Architecture

## System Overview

```mermaid
graph TB
    subgraph Client ["Client (React + Vite - :5173)"]
        direction TB
        App["App.jsx<br/>Router + AuthProvider"]

        subgraph Pages
            Landing["Landing<br/>Login / Register"]
            Onboarding["Onboarding<br/>5-Step Wizard"]
            Lobby["Lobby<br/>Find Someone"]
            Matching["Matching<br/>Queue Spinner"]
            Chat["Chat<br/>Messages + Timer"]
            PostChat["PostChat<br/>Summary + Points"]
            Profile["Profile<br/>Stats + Leaderboard"]
        end

        subgraph Hooks
            useAuth["useAuth<br/>Auth Context"]
            useSocket["useSocket<br/>Socket Singleton"]
            useTimer["useTimer<br/>Countdown"]
            useVoice["useVoiceRecorder<br/>MediaRecorder API"]
        end

        subgraph Components
            ExtModal["ExtensionModal"]
            PhotoModal["PhotoExchangeModal"]
            FFModal["FriendsForeverModal"]
        end

        APIClient["api.js<br/>REST Wrapper"]
        SocketClient["socket.js<br/>Socket.io Singleton"]
    end

    subgraph Server ["Server (Express + Socket.io - :3001)"]
        direction TB
        Express["Express App<br/>index.js"]

        subgraph Routes ["REST Routes (/api/*)"]
            AuthRoute["/auth<br/>register, login, me, logout"]
            UserRoute["/users<br/>profile, trauma, onboarding"]
            UploadRoute["/upload<br/>photo, voice (multer)"]
            ConvRoute["/conversations<br/>list, detail"]
            PointsRoute["/points<br/>log, total"]
        end

        subgraph Middleware
            Session["session.js<br/>In-Memory Token Store"]
            Upload["upload.js<br/>Multer (photo + voice)"]
        end

        subgraph Services
            Matchmaker["matchmaker.js<br/>Queue + Pairing"]
            ConvService["conversation.js<br/>CRUD + Lifecycle"]
            TimerService["timer.js<br/>Server-side setTimeout"]
            PointsService["points.js<br/>Award Functions"]
            TraumaService["trauma.js<br/>Keyword Matching"]
        end

        subgraph SocketHandlers ["Socket.io Handlers"]
            MatchHandler["Matchmaking<br/>join/leave queue"]
            ChatHandler["Chat<br/>text + voice messages"]
            TimerHandler["Timer<br/>start, warn, expire"]
            ExtHandler["Extension<br/>vote + resolve"]
            PhotoHandler["Photo Exchange<br/>submit + reveal"]
            RatingHandler["Rating<br/>star scoring"]
            DisconnectHandler["Disconnect<br/>30s grace period"]
        end
    end

    subgraph Storage
        SQLite["SQLite DB<br/>traumachat.db"]
        FileSystem["Filesystem<br/>uploads/photos + voice"]
    end

    App --> Pages
    App --> Hooks
    Pages --> Components
    APIClient -->|"HTTP REST"| Routes
    SocketClient <-->|"WebSocket"| SocketHandlers
    Routes --> Middleware
    Routes --> Services
    SocketHandlers --> Services
    Services --> SQLite
    Upload --> FileSystem
```

## Conversation State Machine

```mermaid
stateDiagram-v2
    [*] --> Matched: Two users in queue
    Matched --> Active: Timer starts

    Active --> Active: Messages exchanged
    Active --> ExtensionPending: Timer expires (3 min)

    ExtensionPending --> Closed: Either votes "Leave"
    ExtensionPending --> FriendsForever: Both vote "Friends Forever"
    ExtensionPending --> PhotoExchange: Otherwise (Extend/mixed)

    PhotoExchange --> PhotoExchange: Waiting for both photos
    PhotoExchange --> Rating: Both photos submitted → Reveal

    Rating --> Active: Both rated → New timer starts

    FriendsForever --> FriendsForever: Unlimited chat (no timer)

    Closed --> [*]

    Active --> Closed: Partner disconnects (30s timeout)
    ExtensionPending --> Closed: Partner disconnects
    PhotoExchange --> Closed: Partner disconnects
```

## Extension Voting Logic

```mermaid
flowchart TD
    A[Timer Expires] --> B[Both users see Extension Modal]
    B --> C{Collect Both Votes}

    C --> D{Either voted Leave?}
    D -->|Yes| E[Close Conversation]

    D -->|No| F{Both voted Friends Forever?}
    F -->|Yes| G[Friends Forever!<br/>+100 pts each<br/>Timer removed]

    F -->|No| H[Photo Exchange<br/>+25 pts each]
    H --> I[Both upload photos]
    I --> J[Simultaneous reveal]
    J --> K[Both rate 1-5 stars]
    K --> L[Points awarded: score × 5]
    L --> M[New 3-min timer starts]
    M --> A
```

## Points System Flow

```mermaid
flowchart LR
    Match[Matched] -->|+10| P[Points]
    Extend[Extension] -->|+25| P
    Extend -->|"+10 bonus<br/>(3+ streak)"| P
    Rate[Rated by partner] -->|"score × 5<br/>(5-25)"| P
    FF[Friends Forever] -->|+100| P
```

## Data Flow: Real-Time Chat

```mermaid
sequenceDiagram
    participant U1 as User 1 (Browser Tab)
    participant S as Server (Socket.io)
    participant DB as SQLite
    participant U2 as User 2 (Browser Tab)

    U1->>S: join-queue
    U2->>S: join-queue
    S->>S: matchmaker.tryMatch()
    S->>DB: INSERT conversation
    S->>DB: INSERT system message
    S->>U1: matched (partner info)
    S->>U2: matched (partner info)
    S->>S: startTimer(3 min)
    S->>U1: timer-start (endTime)
    S->>U2: timer-start (endTime)

    loop Chat Messages
        U1->>S: send-message
        S->>DB: INSERT message
        S->>U1: new-message
        S->>U2: new-message
    end

    S->>U1: timer-warning (30s left)
    S->>U2: timer-warning (30s left)
    S->>U1: timer-expired
    S->>U2: timer-expired

    U1->>S: extension-vote (extend)
    U2->>S: extension-vote (extend)
    S->>DB: INSERT votes
    S->>S: Resolve: photo_exchange
    S->>U1: extension-result
    S->>U2: extension-result
```

## Onboarding Flow

```mermaid
flowchart LR
    A[1. Account<br/>Name + Credentials] --> B[2. Photo<br/>Profile Upload]
    B --> C[3. Demographics<br/>Bio, Location,<br/>Gender, Age]
    C --> D[4. Trauma<br/>Dr. Slavenko<br/>Assessment]
    D --> E[5. Confirm<br/>Review + Enter]
    E --> F[Lobby]
```

## Tech Stack

```mermaid
graph LR
    subgraph Frontend
        React[React 18]
        Vite[Vite 7]
        RR[React Router 7]
        SIOc[Socket.io Client]
    end

    subgraph Backend
        Node[Node.js]
        Exp[Express 4]
        SIOs[Socket.io 4]
        Multer[Multer]
        Bcrypt[bcrypt]
    end

    subgraph Data
        SQLite3[better-sqlite3]
        FS[Filesystem]
    end

    Frontend <-->|"HTTP + WS<br/>via Vite Proxy"| Backend
    Backend <--> Data
```
