import { useState, useCallback, useRef, useEffect } from 'react'
import GridCanvas from './components/GridCanvas'
import Sidebar from './components/Sidebar'
import useSocket from './hooks/useSocket'

// Color palette for users
const COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

const COOLDOWN_DURATION = 3 // seconds

function App() {
  // ── Socket connection (replaces all mock/simulated state) ──
  const {
    connected,
    onlineUsers,
    claimedCells,
    setClaimedCells,
    claimCell,
    triggerPulseRef,
  } = useSocket()

  const [sidebarOpen, setSidebarOpen] = useState(true)

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

      // Don't allow clicking already-claimed cells
      if (existing && !existing.optimistic) return

      // Store the pulse trigger so socket events can fire it
      triggerPulseRef.current = triggerPulseFn

      // --- Optimistic UI: instantly show the cell as claimed ---
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      setClaimedCells((prev) => {
        const next = new Map(prev)
        next.set(key, { color, label: 'U', optimistic: true })
        return next
      })

      // Start the cooldown immediately
      startCooldown()

      // --- Emit to server (rollback handled by useSocket on failure) ---
      claimCell(x, y, color)
    },
    [cooldownActive, claimedCells, startCooldown, claimCell, setClaimedCells, triggerPulseRef]
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
        onCellClick={handleCellClick}
        currentUser="U"
        cooldownActive={cooldownActive}
        cooldownRemaining={cooldownRemaining}
      />

      {/* Floating Sidebar */}
      <Sidebar
        stats={stats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        connected={connected}
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
