/**
 * Live Grid War — Backend Server
 *
 * Express + Socket.io server that manages a shared 100×100 grid.
 * Broadcasts only delta updates (not full state) for efficiency.
 */

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const GridStore = require('./grid')
const registerSocketHandlers = require('./socketHandlers')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    onlineUsers: users.count,
    cellsClaimed: grid.claimedCount,
    gridSize: grid.size,
  })
})

// REST endpoint to fetch grid state (fallback if WebSocket fails)
app.get('/api/grid', (_req, res) => {
  res.json({
    gridSize: grid.size,
    cells: grid.getFullState(),
  })
})

// ---------------------------------------------------------------------------
// HTTP + Socket.io server
// ---------------------------------------------------------------------------
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  // Performance tuning
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e4, // 10KB — small payloads only
})

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
const grid = new GridStore()
const users = { count: 0 }
const cooldowns = new Map() // socket.id → last claim timestamp

// ---------------------------------------------------------------------------
// Socket.io connection handler
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  users.count++

  // Broadcast updated user count to everyone
  io.emit('user-count', { onlineUsers: users.count })

  // Register all event handlers for this socket
  registerSocketHandlers(io, socket, grid, users, cooldowns)
})

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════╗')
  console.log('  ║        🎮  LIVE GRID WAR SERVER          ║')
  console.log('  ╠══════════════════════════════════════════╣')
  console.log(`  ║  HTTP:    http://localhost:${PORT}           ║`)
  console.log(`  ║  WS:      ws://localhost:${PORT}             ║`)
  console.log(`  ║  Health:  http://localhost:${PORT}/health     ║`)
  console.log(`  ║  Grid:    ${grid.size}×${grid.size} (${grid.size * grid.size} cells)       ║`)
  console.log('  ╚══════════════════════════════════════════╝')
  console.log('')
})

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal) {
  console.log(`\n[!] Received ${signal}, shutting down gracefully...`)
  io.close(() => {
    server.close(() => {
      console.log('[✓] Server closed.')
      process.exit(0)
    })
  })
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 5000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
