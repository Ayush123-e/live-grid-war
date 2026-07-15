const CD_LIMIT = 3000

const ADJECTIVES = ["Neon", "Pixel", "Cyber", "Retro", "Laser", "Quantum", "Turbo", "Shadow", "Matrix", "Logic", "Circuit", "Data", "Bit", "Synth", "Aura", "Binary", "Hyper", "Vortex", "Cosmic", "Glitch"];
const NOUNS = ["Knight", "Boss", "Overlord", "Warrior", "Samurai", "Wave", "Ninja", "King", "Falcon", "Ghost", "Slayer", "Runner", "Seeker", "Viper", "Wizard", "Phantom", "Crusher", "Storm", "Striker", "Specter"];
const VIBRANT_COLORS = ["#6366f1", "#f43f5e", "#22c55e", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#3b82f6", "#f97316", "#a855f7", "#14b8a6"];

function generateRandomProfile() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const color = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return { username: `${adj}${noun}_${num}`, color };
}

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

function broadcastLeaderboard(io, grid, profiles) {
  const counts = {};
  for (const id of profiles.keys()) counts[id] = 0;

  for (const cell of grid.cells.values()) {
    if (counts[cell.owner] !== undefined) counts[cell.owner]++;
  }

  const leaderboard = Array.from(profiles.entries()).map(([id, profile]) => ({
    id,
    name: profile.username,
    color: profile.color,
    cells: counts[id] || 0,
    online: true,
  }));

  leaderboard.sort((a, b) => b.cells - a.cells || a.name.localeCompare(b.name));
  io.emit('leaderboard:update', leaderboard.slice(0, 5));
}

function registerSocketHandlers(io, socket, grid, users, cooldowns, profiles) {
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
    profile = generateUniqueProfile(profiles);
  }

  profiles.set(socket.id, profile);

  socket.emit('user:profile', {
    username: profile.username,
    color: profile.color,
  });

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

  console.log(`[+] Profile assigned: ${profile.username} (${profile.color}) for ${socket.id}`);
  broadcastLeaderboard(io, grid, profiles);

  socket.on('claim-cell', (data, ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};
    if (!data || typeof data !== 'object') {
      return respond({ success: false, reason: 'Invalid payload' });
    }

    const { x, y } = data;
    const lastClaim = cooldowns.get(socket.id) || 0
    const elapsed = Date.now() - lastClaim

    if (elapsed < CD_LIMIT) {
      const remainingMs = CD_LIMIT - elapsed;
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

    const userColor = profile.color;
    const result = grid.tryClaimCell(x, y, userColor, socket.id);

    switch (result.status) {
      case 'error':
        return respond({ success: false, reason: result.reason });

      case 'locked':
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell is being processed by another request',
          currentCell: grid.getCell(x, y),
          clickCount: grid.clickCounts.get(`${x},${y}`) || 0,
        });
        return respond({ success: false, reason: 'Cell is locked' });

      case 'conflict': {
        const winner = result.currentOwner;
        socket.emit('sync-rollback', {
          x,
          y,
          reason: 'Cell already claimed by another user',
          currentCell: winner,
          clickCount: result.clickCount,
        });

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

      case 'unclaimed':
        respond({ success: true, cell: result.cell });
        io.emit('cell-updated', {
          ...result.cell,
          clickCount: result.clickCount,
        });
        broadcastLeaderboard(io, grid, profiles);
        break;

      case 'claimed':
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
  });

  socket.on('disconnect', () => {
    users.count--;
    const releasedCells = [];
    for (const [key, cell] of grid.cells.entries()) {
      if (cell.owner === socket.id) {
        grid.cells.delete(key);
        const [x, y] = key.split(',').map(Number);
        releasedCells.push({ x, y });
      }
    }

    profiles.delete(socket.id);
    cooldowns.delete(socket.id);

    io.emit('user-count', { onlineUsers: users.count });

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

    broadcastLeaderboard(io, grid, profiles);
    console.log(`[-] Client disconnected: ${profile.username} | Online: ${users.count} | Released: ${releasedCells.length} cells`);
  });
}

module.exports = registerSocketHandlers;
