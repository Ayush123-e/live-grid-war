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
const GridStore = require('./services/gridService')
const registerSocketHandlers = require('./handlers/socketHandlers')

const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.send(' Live Grid War Backend Server is running! Use /health to check status.')
})

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    onlineUsers: users.count,
    cellsClaimed: grid.claimedCount,
    gridSize: grid.size,
  })
})

app.get('/api/grid', (_req, res) => {
  res.json({
    gridSize: grid.size,
    cells: grid.getFullState(),
  })
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e4,
})

const grid = new GridStore()
const users = { count: 0 }
const cooldowns = new Map()
const profiles = new Map()

io.on('connection', (socket) => {
  users.count++

  io.emit('user-count', { onlineUsers: users.count })

  registerSocketHandlers(io, socket, grid, users, cooldowns, profiles)
})

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

function shutdown(signal) {
  console.log(`\n[!] Received ${signal}, shutting down gracefully...`)
  io.close(() => {
    server.close(() => {
      console.log('[✓] Server closed.')
      process.exit(0)
    })
  })
  setTimeout(() => process.exit(1), 5000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
