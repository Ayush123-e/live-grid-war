/**
 * Socket.io event handlers — separated from server setup for testability.
 */

const COOLDOWN_MS = 3000

/**
 * Register all socket events for a connected client.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('./grid')} grid
 * @param {{ count: number }} users — shared mutable user counter
 * @param {Map<string, number>} cooldowns — per-socket cooldown tracker
 */
function registerSocketHandlers(io, socket, grid, users, cooldowns) {
  // --- Send initial state to the newly connected client ---
  socket.emit('grid:init', {
    gridSize: grid.size,
    cells: grid.getFullState(),
    onlineUsers: users.count,
  })

  console.log(
    `[+] Client connected: ${socket.id} | Online: ${users.count}`
  )

  // --- Claim cell ---
  socket.on('claim-cell', (data, ack) => {
    // Ensure callback exists for acknowledgement
    const respond = typeof ack === 'function' ? ack : () => {}

    // Basic shape validation
    if (!data || typeof data !== 'object') {
      return respond({ success: false, reason: 'Invalid payload' })
    }

    const { x, y, color } = data

    // Cooldown check
    const lastClaim = cooldowns.get(socket.id) || 0
    const elapsed = Date.now() - lastClaim
    if (elapsed < COOLDOWN_MS) {
      const wait = ((COOLDOWN_MS - elapsed) / 1000).toFixed(1)
      return respond({
        success: false,
        reason: `Cooldown active — wait ${wait}s`,
      })
    }

    // Attempt to claim
    const result = grid.claimCell(x, y, color, socket.id)

    if (!result.success) {
      return respond({ success: false, reason: result.reason })
    }

    // Set cooldown timestamp
    cooldowns.set(socket.id, Date.now())

    // Acknowledge success to the sender
    respond({ success: true, cell: result.cell })

    // Broadcast delta update to ALL clients (including sender for consistency)
    io.emit('cell-updated', result.cell)

    console.log(
      `[*] Cell claimed: (${x},${y}) color=${color} by=${socket.id} | Total: ${grid.claimedCount}`
    )
  })

  // --- Disconnect ---
  socket.on('disconnect', (reason) => {
    users.count--
    cooldowns.delete(socket.id)

    // Broadcast updated user count
    io.emit('user-count', { onlineUsers: users.count })

    console.log(
      `[-] Client disconnected: ${socket.id} (${reason}) | Online: ${users.count}`
    )
  })
}

module.exports = registerSocketHandlers
