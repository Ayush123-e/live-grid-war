/**
 * Socket.io event handlers — separated from server setup for testability.
 *
 * Anti-cheat features:
 *   1. Strict rate limiting (3s cooldown per socket, server-enforced)
 *   2. Conflict resolution (first-writer-wins with sync-rollback for losers)
 *   3. Per-cell locking to guarantee sequential claim processing
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

    // ── Step 1: Basic shape validation ──
    if (!data || typeof data !== 'object') {
      return respond({ success: false, reason: 'Invalid payload' })
    }

    const { x, y, color } = data

    // ── Step 2: Strict rate limiting ──
    const lastClaim = cooldowns.get(socket.id) || 0
    const elapsed = Date.now() - lastClaim

    if (elapsed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsed
      const remainingSec = (remainingMs / 1000).toFixed(1)

      // Emit dedicated error-cooldown event
      socket.emit('error-cooldown', {
        reason: `Rate limited — wait ${remainingSec}s`,
        remainingMs,
        remainingSec: parseFloat(remainingSec),
        cell: { x, y },
      })

      console.log(
        `[⏳] Rate limited: ${socket.id} tried (${x},${y}) — ${remainingSec}s remaining`
      )

      return respond({
        success: false,
        reason: `Cooldown active — wait ${remainingSec}s`,
      })
    }

    // ── Step 3: Attempt claim with conflict detection ──
    const result = grid.tryClaimCell(x, y, color, socket.id)

    switch (result.status) {
      // -- Validation failure --
      case 'error': {
        return respond({ success: false, reason: result.reason })
      }

      // -- Cell is locked (another claim in-flight for same cell) --
      case 'locked': {
        // Tell client to rollback their optimistic update
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell is being processed by another request',
          currentCell: grid.getCell(x, y),
        })

        console.log(
          `[🔒] Lock contention: ${socket.id} tried (${x},${y}) — cell locked`
        )

        return respond({
          success: false,
          reason: 'Cell is being processed, try again',
        })
      }

      // -- Conflict: another user already owns this cell --
      case 'conflict': {
        const winner = result.currentOwner

        // Send rollback to the loser with the winning cell's data
        // so the client can revert their optimistic UI and show
        // the correct owner's color instead
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell already claimed by another user',
          currentCell: winner,
        })

        console.log(
          `[⚔️] Conflict: ${socket.id} lost (${x},${y}) — owned by ${winner.owner}`
        )

        return respond({
          success: false,
          reason: 'Cell already claimed by another user',
          currentCell: winner,
        })
      }

      // -- Success: cell was free or self-owned --
      case 'claimed': {
        // Set cooldown timestamp (only on successful claim)
        cooldowns.set(socket.id, Date.now())

        // Acknowledge success to the sender
        respond({ success: true, cell: result.cell })

        // Broadcast delta update to ALL clients (including sender for state consistency)
        io.emit('cell-updated', result.cell)

        console.log(
          `[✓] Cell claimed: (${x},${y}) color=${color} by=${socket.id} | Total: ${grid.claimedCount}`
        )
        break
      }

      default: {
        respond({ success: false, reason: 'Unknown server error' })
      }
    }
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
