# 🎮 Live Grid War

A high-performance, real-time shared multiplayer grid game where players battle to claim territory on a massive 100×100 grid (10,000 cells). Built with **React (Vite)**, **HTML5 Canvas**, and **Node.js (Express + Socket.io)**.

---

## 🚀 Key Features

### ⚡ Ultra-Fast 60FPS Grid rendering
- **HTML5 Canvas Drawing**: Renders the 100x100 grid dynamically inside a high-frequency `requestAnimationFrame` loop, bypassing standard DOM overhead.
- **Viewport Culling (Grid Clipping)**: Only cells visible within the viewport are drawn to screen, minimizing GPU load.
- **DPR-Aware Grid scaling**: Auto-detects and scales for High-DPI/Retina screens for clean line rendering.
- **Sleek Zoom & Pan**: Intuitive drag-to-pan and mouse wheel zoom (centered dynamically on the cursor).

### 🛠️ Real-time Synchronization & Conflict Resolution
- **Optimistic UI Updates**: Instantly highlights the clicked cell with a dashed state border before server confirmation.
- **Sequential Race Condition Locking**: Server-side cell-level mutex locking ensures that nearly simultaneous clicks are resolved sequentially (first-writer-wins).
- **Graceful Rollback**: The loser of a claim race condition automatically receives a `sync-rollback` event with the winner's info to smoothly correct the client UI.
- **Anti-Cheat Cooldown**: Strict server-enforced 3-second rate limit. Attempts to bypass are caught and trigger an `error-cooldown` rollback.

### 🎨 Premium Aesthetics & UI Components
- **Vibrant Thermal Heatmap Overlay**: Switch to "View Activity Heatmap" to visualize historical click frequency using a monochrome thermal color interpolation gradient.
- **GPU-Accelerated Leaderboard**: Real-time rank changes slide past each other with smooth, hardware-accelerated transitions.
- **Automatic Identity Generator**: Players are automatically assigned a cool username (e.g. `SynthStorm_452`) and a persistent vibrant profile color.
- **Floating Glassmorphic Panels**: Modern, translucent sidebar showing Uptime, claimed statistics, and user profile data.

---

## 📂 Project Structure

```bash
live-grid-war/
├── client/                 # React frontend (Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── components/
│   │   │   ├── GridCanvas.jsx   # High-performance canvas-based grid rendering
│   │   │   └── Sidebar.jsx      # Glassmorphic stats & animated leaderboard
│   │   ├── hooks/
│   │   │   └── useSocket.js     # Real-time state synchronizer hook
│   │   ├── App.jsx              # Application control & coordination
│   │   ├── main.jsx
│   │   └── index.css            # Custom styling & Tailwind theme variables
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Production-grade Node.js backend (Socket.io)
│   ├── src/
│   │   ├── index.js             # HTTP server configuration & connection events
│   │   ├── grid.js              # Sparse-map grid state & locks
│   │   └── socketHandlers.js    # Identity generator, anti-cheat & game events
│   └── package.json
│
└── README.md               # Main project documentation (this file)
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (v9 or higher recommended)

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
   *The server will run on `http://localhost:3001`.*

3. **Run Frontend Client**:
   *Open a new terminal window or tab:*
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *The client will run on `http://localhost:5173`.*

---

## ⚡ Game Controls & Operations

- **Pan**: Left click and drag anywhere on the grid.
- **Zoom**: Scroll your mouse wheel or touchpad.
- **Claim Cell**: Click once on any unclaimed cell to claim it.
- **Unclaim Cell**: Click on your own claimed cell to release it.
- **Toggle Heatmap**: Click the **"View Activity Heatmap"** floating pill at the top of the page to toggle activity visualization.

---

## 🛡️ Anti-Cheat & Security

- **Server-Controlled Profiles**: Colors and usernames are strictly assigned on connection. Forged client colors are rejected.
- **Delta-Only Broadcasting**: Updates are sent as individual cell deltas rather than syncing the full grid, blocking bandwidth exhaustion.
- **Server Cooldown Verification**: If a client attempts to bypass the 3-second claim limit, the server enforces a cooldown lock and sends a rollback payload.
