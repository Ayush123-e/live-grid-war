import { useState, useCallback, useRef, useEffect } from 'react'
import GridCanvas from './components/GridCanvas'
import Sidebar from './components/Sidebar'
import useSocket from './hooks/useSocket'

const COOLDOWN_DURATION = 3 // seconds

function App() {
  const {
    socket,
    connected,
    onlineUsers,
    claimedCells,
    clickCounts,
    setClaimedCells,
    claimCell,
    triggerPulseRef,
    userProfile,
    leaderboard,
  } = useSocket()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState(false)

  // Cooldown state
  const [cooldownActive, setCooldownActive] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownTimerRef = useRef(null)
  const cooldownStartRef = useRef(0)

  // Start cooldown countdown
  const startCooldown = useCallback(() => {
    setCooldownActive(true)
    setCooldownRemaining(COOLDOWN_DURATION)
    cooldownStartRef.current = performance.now()

    // Clear any existing timer
    if (cooldownTimerRef.current) {
      cancelAnimationFrame(cooldownTimerRef.current)
    }

    const tick = () => {
      const elapsed = (performance.now() - cooldownStartRef.current) / 1000
      const remaining = Math.max(0, COOLDOWN_DURATION - elapsed)
      setCooldownRemaining(remaining)

      if (remaining > 0) {
        cooldownTimerRef.current = requestAnimationFrame(tick)
      } else {
        setCooldownActive(false)
        setCooldownRemaining(0)
      }
    }
    cooldownTimerRef.current = requestAnimationFrame(tick)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        cancelAnimationFrame(cooldownTimerRef.current)
      }
    }
  }, [])

  const handleCellClick = useCallback(
    (x, y, triggerPulseFn) => {
      if (cooldownActive) return

      const key = `${x},${y}`
      const existing = claimedCells.get(key)
      const currentSocketId = socket.current?.id

      // Check ownership
      const isOwnCell = existing && existing.owner === currentSocketId

      // Block clicking cells owned by others
      if (existing && !isOwnCell && !existing.optimistic) return

      if (isOwnCell) {
        // Optimistic unclaim (toggling own cell off)
        setClaimedCells((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        // Emit claimCell to server which will toggle it off (unclaim)
        claimCell(x, y)
        return
      }

      // Store the pulse trigger so socket events can fire it
      triggerPulseRef.current = triggerPulseFn

      // --- Optimistic UI: instantly show the cell as claimed ---
      const color = userProfile?.color || '#6366f1'
      const label = userProfile?.username?.slice(-2)?.toUpperCase() || 'U'

      setClaimedCells((prev) => {
        const next = new Map(prev)
        next.set(key, { color, label, owner: currentSocketId, optimistic: true })
        return next
      })

      // Start the cooldown immediately
      startCooldown()

      // --- Emit to server ---
      claimCell(x, y)
    },
    [cooldownActive, claimedCells, startCooldown, claimCell, setClaimedCells, triggerPulseRef, userProfile, socket]
  )

  const stats = {
    onlineUsers,
    cellsClaimed: claimedCells.size,
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: '#0b0d14' }}>
      {/* Grid Canvas fills the entire viewport */}
      <GridCanvas
        claimedCells={claimedCells}
        clickCounts={clickCounts}
        onCellClick={handleCellClick}
        currentUser={userProfile?.username || 'U'}
        cooldownActive={cooldownActive}
        cooldownRemaining={cooldownRemaining}
        heatmapMode={heatmapMode}
      />

      {/* Control panel for toggling heatmap mode */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1 rounded-full transition-all duration-300"
        style={{
          background: 'rgba(12, 14, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <button
          onClick={() => setHeatmapMode(!heatmapMode)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold select-none transition-all duration-300 cursor-pointer"
          style={{
            background: heatmapMode ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
            color: heatmapMode ? '#fff' : '#8b8fa3',
            boxShadow: heatmapMode ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>{heatmapMode ? 'Heatmap Mode Active' : 'View Activity Heatmap'}</span>
        </button>
      </div>

      {/* Floating Sidebar */}
      <Sidebar
        stats={stats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        connected={connected}
        userProfile={userProfile}
        leaderboard={leaderboard}
      />

      {/* Top-left branding */}
      <div
        className="fixed top-4 left-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{
          background: 'rgba(12,14,20,0.85)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          border: '1px solid rgba(99,102,241,0.1)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight" style={{ color: '#e2e4ed' }}>
            Live Grid War
          </h1>
          <p className="text-[10px] font-medium" style={{ color: '#5c5f73' }}>
            100 × 100 · Real-time
          </p>
        </div>
        <div
          className="ml-2 w-1.5 h-1.5 rounded-full"
          style={{
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected
              ? '0 0 8px rgba(34,197,94,0.6)'
              : '0 0 8px rgba(239,68,68,0.6)',
            animation: connected ? 'pulse 2s infinite' : 'none',
          }}
        />
      </div>
    </div>
  )
}

export default App
