/**
 * Socket.io event handlers — separated from server setup for testability.
 *
 * Premium & Anti-cheat features:
 *   1. Dynamic Leaderboard (computed across active profiles, broadcast top 5)
 *   2. User Identity & Colors (cool names generated & persistent color assigned)
 *   3. Click counts & Heatmap tracking synced in real-time
 *   4. Strict Rate Limiting (3s cooldown server-enforced)
 *   5. Race-condition sequential cell locks & rollback events
 */

const COOLDOWN_MS = 3000

const ADJECTIVES = ["Neon", "Pixel", "Cyber", "Retro", "Laser", "Quantum", "Turbo", "Shadow", "Matrix", "Logic", "Circuit", "Data", "Bit", "Synth", "Aura", "Binary", "Hyper", "Vortex", "Cosmic", "Glitch"];
const NOUNS = ["Knight", "Boss", "Overlord", "Warrior", "Samurai", "Wave", "Ninja", "King", "Falcon", "Ghost", "Slayer", "Runner", "Seeker", "Viper", "Wizard", "Phantom", "Crusher", "Storm", "Striker", "Specter"];
const VIBRANT_COLORS = ["#6366f1", "#f43f5e", "#22c55e", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#3b82f6", "#f97316", "#a855f7", "#14b8a6"];

/**
 * Generate a random cool name and color.
 * @returns {{ username: string, color: string }}
 */
function generateRandomProfile() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const color = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  return {
    username: `${adj}${noun}_${num}`,
    color,
  };
}

/**
 * Generate a unique profile not taken by any active user.
 * @param {Map<string, object>} profiles
 * @returns {{ username: string, color: string }}
 */
function generateUniqueProfile(profiles) {
  let profile;
  let attempts = 0;
  const activeNames = new Set(Array.from(profiles.values()).map(p => p.username));
  do {
    profile = generateRandomProfile();
    attempts++;
  } while (activeNames.has(profile.username) && attempts < 100);
  return profile;
}

/**
 * Calculate dynamic Top 5 leaderboard of active users and broadcast to everyone.
 * @param {import('socket.io').Server} io
 * @param {import('./grid')} grid
 * @param {Map<string, object>} profiles
 */
function broadcastLeaderboard(io, grid, profiles) {
  const counts = {};
  for (const id of profiles.keys()) {
    counts[id] = 0;
  }

  // Count claimed cells owned by active sessions
  for (const cell of grid.cells.values()) {
    if (counts[cell.owner] !== undefined) {
      counts[cell.owner]++;
    }
  }

  // Map to leaderboard objects
  const leaderboard = Array.from(profiles.entries()).map(([id, profile]) => ({
    id,
    name: profile.username,
    color: profile.color,
    cells: counts[id] || 0,
    online: true,
  }));

  // Sort by cells count desc, then alphabetically by name
  leaderboard.sort((a, b) => b.cells - a.cells || a.name.localeCompare(b.name));

  const top5 = leaderboard.slice(0, 5);
  io.emit('leaderboard:update', top5);
}

/**
 * Register all socket events for a connected client.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('./grid')} grid
 * @param {{ count: number }} users — shared mutable user counter
 * @param {Map<string, number>} cooldowns — per-socket cooldown tracker
 * @param {Map<string, object>} profiles — per-socket profile tracker
 */
function registerSocketHandlers(io, socket, grid, users, cooldowns, profiles) {
  // Check if user has an existing persisted identity in handshake auth
  let profile = socket.handshake.auth?.profile;

  if (profile && profile.username && profile.color) {
    const isColorValid = typeof profile.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(profile.color);
    const isNameValid = typeof profile.username === 'string' && profile.username.trim().length > 0;
    
    if (isColorValid && isNameValid) {
      profile = {
        username: profile.username.trim(),
        color: profile.color
      };
    } else {
      profile = null;
    }
  }

  if (!profile) {
    // Generate a unique identity
    profile = generateUniqueProfile(profiles);
  }

  profiles.set(socket.id, profile);

  // Send profile to user immediately
  socket.emit('user:profile', {
    username: profile.username,
    color: profile.color,
  });

  // Calculate current top 5 leaderboard
  const getLeaderboardState = () => {
    const counts = {};
    for (const id of profiles.keys()) counts[id] = 0;
    for (const cell of grid.cells.values()) {
      if (counts[cell.owner] !== undefined) counts[cell.owner]++;
    }
    return Array.from(profiles.entries())
      .map(([id, p]) => ({
        id,
        name: p.username,
        color: p.color,
        cells: counts[id] || 0,
        online: true,
      }))
      .sort((a, b) => b.cells - a.cells || a.name.localeCompare(b.name))
      .slice(0, 5);
  };

  // Send full initial state including historical click counts and leaderboard
  socket.emit('grid:init', {
    gridSize: grid.size,
    cells: grid.getFullState().map(cell => {
      const p = profiles.get(cell.owner)
      return {
        ...cell,
        ownerName: p ? p.username : 'Anonymous'
      }
    }),
    clickHistory: Object.fromEntries(grid.clickCounts),
    onlineUsers: users.count,
    leaderboard: getLeaderboardState(),
  });

  console.log(
    `[+] Profile assigned: ${profile.username} (${profile.color}) for ${socket.id}`
  );

  // Broadcast updated leaderboard to reflect new user joining
  broadcastLeaderboard(io, grid, profiles);

  // --- Claim cell ---
  socket.on('claim-cell', (data, ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};

    if (!data || typeof data !== 'object') {
      return respond({ success: false, reason: 'Invalid payload' });
    }

    const { x, y } = data;

    // Rate limiting
    const lastClaim = cooldowns.get(socket.id) || 0
    const elapsed = Date.now() - lastClaim

    if (elapsed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsed;
      const remainingSec = (remainingMs / 1000).toFixed(1);

      socket.emit('error-cooldown', {
        reason: `Rate limited — wait ${remainingSec}s`,
        remainingMs,
        remainingSec: parseFloat(remainingSec),
        cell: { x, y },
      });

      return respond({
        success: false,
        reason: `Cooldown active — wait ${remainingSec}s`,
      });
    }

    // Execute tryClaimCell using server-controlled color
    const userColor = profile.color;
    const result = grid.tryClaimCell(x, y, userColor, socket.id);

    switch (result.status) {
      case 'error': {
        return respond({ success: false, reason: result.reason });
      }

      case 'locked': {
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell is being processed by another request',
          currentCell: grid.getCell(x, y),
          clickCount: grid.clickCounts.get(`${x},${y}`) || 0,
        });
        return respond({ success: false, reason: 'Cell is locked' });
      }

      case 'conflict': {
        const winner = result.currentOwner;
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell already claimed by another user',
          currentCell: winner,
          clickCount: result.clickCount,
        });

        // Broadcast conflict click so other clients update heatmap clickCount
        const winnerProfile = profiles.get(winner.owner)
        io.emit('cell-updated', {
          x,
          y,
          color: winner.color,
          owner: winner.owner,
          ownerName: winnerProfile ? winnerProfile.username : 'Anonymous',
          clickCount: result.clickCount,
        });

        return respond({
          success: false,
          reason: 'Cell already claimed by another user',
          currentCell: winner,
        });
      }

      case 'unclaimed': {
        // Toggled own cell off
        respond({ success: true, cell: result.cell });

        io.emit('cell-updated', {
          ...result.cell,
          clickCount: result.clickCount,
        });

        broadcastLeaderboard(io, grid, profiles);
        break;
      }

      case 'claimed': {
        // Claimed a cell successfully
        cooldowns.set(socket.id, Date.now());
        respond({ success: true, cell: result.cell });

        io.emit('cell-updated', {
          ...result.cell,
          ownerName: profile.username,
          clickCount: result.clickCount,
        });

        broadcastLeaderboard(io, grid, profiles);
        break;
      }
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', (reason) => {
    users.count--;

    // Release all claimed cells owned by the disconnected client
    const releasedCells = [];
    for (const [key, cell] of grid.cells.entries()) {
      if (cell.owner === socket.id) {
        grid.cells.delete(key);
        const [x, y] = key.split(',').map(Number);
        releasedCells.push({ x, y });
      }
    }

    // Remove trackers
    profiles.delete(socket.id);
    cooldowns.delete(socket.id);

    // Broadcast updated user count
    io.emit('user-count', { onlineUsers: users.count });

    // Broadcast released cells to clear them on the frontend grid canvas
    for (const cell of releasedCells) {
      const key = `${cell.x},${cell.y}`;
      io.emit('cell-updated', {
        x: cell.x,
        y: cell.y,
        color: null,
        owner: null,
        clickCount: grid.clickCounts.get(key) || 0,
      });
    }

    // Broadcast updated leaderboard
    broadcastLeaderboard(io, grid, profiles);

    console.log(
      `[-] Client disconnected: ${profile.username} | Online: ${users.count} | Released: ${releasedCells.length} cells`
    );
  });
}

module.exports = registerSocketHandlers;
