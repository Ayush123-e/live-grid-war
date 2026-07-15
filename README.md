# Live Grid War

* **Live Demo**: [https://your-project.vercel.app](https://your-project.vercel.app)
* **Backend API**: [https://your-backend.onrender.com](https://your-backend.onrender.com)

A high-performance, real-time shared multiplayer grid game where players battle to claim territory on a massive 100×100 grid (10,000 cells). Renders dynamically at **60FPS** via **HTML5 Canvas** and synchronizes state in real-time over **Node.js (Express + Socket.io)**.

---

## Architectural Decisions

This project is built using a highly optimized real-time gaming architecture. Below are the key engineering choices that ensure production performance and security:

### 1. HTML5 Canvas for 60FPS Rendering
* **React VDOM Avoidance**: Managing 10,000 interactive cells using standard React state and DOM nodes results in severe virtual DOM diffing bottlenecks. Instead, the grid rendering is completely offloaded to an HTML5 Canvas.
* **Viewport Culling (Grid Clipping)**: The canvas drawing logic computes the visible boundaries based on pan/zoom translation coordinates and only draws cells inside the screen viewport.
* **High-DPI Support**: Renders dynamically based on `window.devicePixelRatio` for retina-grade lines, scaling layout size with window dimensions without pixelation or blur.
* **Optimized Render Loop**: Runs drawing updates inside a high-frequency `requestAnimationFrame` animation loop, updating canvas properties and processing animations smoothly.

### 2. Delta Updates for Socket Efficiency
* **Sparse Event Updates**: Rather than broadcasting the entire 10,000-cell grid whenever a state update occurs, the backend employs a delta-only system.
* **Minimal Payloads**: Cell updates are emitted as discrete events containing only the coordinate diff:
  ```json
  {
    "x": 42,
    "y": 88,
    "color": "#f43f5e",
    "owner": "fJYn3xUkMKM41UECAAAB",
    "ownerName": "LaserFalcon_850",
    "clickCount": 15
  }
  ```
- **Bandwidth Optimization**: Reduces ongoing socket frame size by **99.9%**, enabling hundreds of concurrent users to battle simultaneously without connection lag.

### 3. Redis-Ready Memory Structure
* **Sparse In-Memory Map**: The server stores state using a flat `Map()` keyed by coordinate strings (`"x,y"`). Unclaimed cells occupy zero memory footprint.
* **Horizontal Scalability**: This key-value design maps 1-to-1 with a **Redis Hash** structure (`HSET` / `HGET` / `HDEL`). By storing the grid state in a shared Redis cache, the server is ready to scale horizontally across multiple stateless processes using Socket.io's Redis Adapter for Pub/Sub event broadcasting.

### 4. Race Condition Mitigation & Rollbacks
* **FIFO Transaction Queue**: Node.js processes incoming WebSocket TCP packets sequentially. The first claim request arriving at the server tick succeeds.
* **State Validation & Rollbacks**: If two clients click the same cell at the same millisecond, the first request is claimed. The second request hits a state validation conflict and is immediately rejected.
* **Optimistic UI Sync**: The client instantly highlights clicks on the canvas (optimistic render). If the server rejects the claim, a `'sync-rollback'` event is sent to the client to immediately revert the cell state back to the winner's color.

### 5. LocalStorage Identity Caching
* **Persistent Sessions**: Generated profiles (anonymous usernames like `"TurboFalcon_297"` and persistent vibrant colors) are saved in client-side `localStorage`.
* **Handshake Authentication**: On page reload or network reconnection, the client reads the cache and passes the profile inside the Socket.io `auth` handshake packet. The server validates and rebinds the existing session, preventing identity resets.

---

## Project Structure

```bash
live-grid-war/
├── client/                 # React frontend (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── components/
│   │   │   ├── GridCanvas.jsx   # Dynamic 60FPS canvas & interactive mouse handlers
│   │   │   └── Sidebar.jsx      # Glassmorphic sidebar panel & rank leaderboard
│   │   ├── hooks/
│   │   │   └── useSocket.js     # WebSocket connection hook & localStorage identity
│   │   ├── utils/
│   │   │   └── initials.js      # dynamic initials parser utility
│   │   ├── App.jsx              # Application overlays & coordinate controller
│   │   ├── main.jsx
│   │   └── index.css            # Custom CSS animations & Tailwind configuration
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Node.js backend (Express + Socket.io)
│   ├── src/
│   │   ├── config/              # (Optional) Redis/Env configuration
│   │   ├── handlers/
│   │   │   └── socketHandlers.js # Identity generator, anti-cheat & game events
│   │   ├── services/
│   │   │   └── gridService.js   # Sparse grid Map & state methods
│   │   └── index.js             # HTTP setup & connection entrypoint
│   └── package.json
│
└── README.md               # Architecture documentation (this file)
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) (v9+)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ayush123-e/live-grid-war.git
   cd live-grid-war
   ```

2. **Run Backend Server**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *The server will start on `http://localhost:3001`.*

3. **Run Frontend Client**:
   *Open a new terminal window:*
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *The client will start on `http://localhost:5173`.*

---

## Game Controls & Operations

* **Pan**: Left click and drag anywhere on the grid viewport.
* **Zoom**: Scroll your mouse wheel or pinch/zoom on touchpads.
* **Claim Cell**: Click once on any unclaimed cell to claim it.
* **Unclaim Cell**: Click on your own claimed cell to release it.
* **Toggle Heatmap**: Toggle the **"View Activity Heatmap"** floating widget to swap user colors with thermal click indicators.

---

## Security & Anti-Cheat

* **Anti-Cheat Cooldown**: The server enforces a hard **3-second cooldown rate-limit** per socket session. UI bypass attempts are automatically dropped and rolled back on the client canvas.
* **Handshake Validation**: Client-supplied profiles are fully validated (hex color strings and characters checks) on connection handshake before acknowledgment.
