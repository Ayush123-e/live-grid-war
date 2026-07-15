import { useState, useCallback, useRef, useEffect } from 'react'
import GridCanvas from './components/GridCanvas'
import Sidebar from './components/Sidebar'
import useSocket from './hooks/useSocket'
import { getInitials } from './utils/initials'

const CD_TIME = 3

function App() {
  const {
    socket,
    connected,
    usersOnline,
    cells,
    clicks,
    serverBootTime,
    setCells,
    claimCell,
    onPulse,
    profile,
    leaderboard,
  } = useSocket()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState(false)
  const [onCooldown, setOnCooldown] = useState(false)
  const [cdLeft, setCdLeft] = useState(0)
  const cdTimer = useRef(null)
  const cdStart = useRef(0)

  const startCooldown = useCallback(() => {
    setOnCooldown(true)
    setCdLeft(CD_TIME)
    cdStart.current = performance.now()

    if (cdTimer.current) cancelAnimationFrame(cdTimer.current)

    const tick = () => {
      const elapsed = (performance.now() - cdStart.current) / 1000
      const remaining = Math.max(0, CD_TIME - elapsed)
      setCdLeft(remaining)

      if (remaining > 0) {
        cdTimer.current = requestAnimationFrame(tick)
      } else {
        setOnCooldown(false)
        setCdLeft(0)
      }
    }
    cdTimer.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => cdTimer.current && cancelAnimationFrame(cdTimer.current), [])

  const handleCellClick = useCallback(
    (x, y, triggerPulseFn) => {
      if (onCooldown) return

      const key = `${x},${y}`
      const existing = cells.get(key)
      const socketId = socket.current?.id
      const isOwnCell = existing && existing.owner === socketId

      if (existing && !isOwnCell && !existing.optimistic) return

      if (isOwnCell) {
        setCells((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        claimCell(x, y)
        return
      }

      onPulse.current = triggerPulseFn

      const color = profile?.color || '#6366f1'
      const label = getInitials(profile?.username)

      setCells((prev) => {
        const next = new Map(prev)
        next.set(key, { 
          color, 
          label, 
          owner: socketId, 
          ownerName: profile?.username || 'Anonymous', 
          optimistic: true 
        })
        return next
      })

      startCooldown()
      claimCell(x, y)
    },
    [onCooldown, cells, startCooldown, claimCell, setCells, onPulse, profile, socket]
  )

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0f19]">
      <GridCanvas
        cells={cells}
        clicks={clicks}
        onCellClick={handleCellClick}
        currentUser={profile?.username || 'U'}
        onCooldown={onCooldown}
        cdLeft={cdLeft}
        heatmapMode={heatmapMode}
      />

      <div className="absolute inset-0 z-10 pointer-events-none">
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-auto"
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-md"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(30, 41, 59, 0.8)',
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

          <div className="flex items-center gap-2 p-1 rounded-xl backdrop-blur-md transition-all duration-300"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(30, 41, 59, 0.8)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={() => setHeatmapMode(!heatmapMode)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold select-none transition-all duration-300 cursor-pointer w-full"
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
        </div>

        <Sidebar
          stats={{ onlineUsers: usersOnline, cellsClaimed: cells.size, serverBootTime }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          connected={connected}
          userProfile={profile}
          leaderboard={leaderboard}
        />

        <div 
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm pointer-events-auto"
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(30, 41, 59, 0.8)',
            color: '#8b8fa3',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <span>Scroll to zoom • Drag to pan</span>
        </div>

        {onCooldown && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.25) 100%)',
              }}
            />

            <div
              onMouseDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col items-center gap-3 pointer-events-auto"
              style={{
                animation: 'cooldownFadeIn 0.3s ease-out',
              }}
            >
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke="rgba(99,102,241,0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke="url(#cooldownGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - cdLeft / CD_TIME)}`}
                    style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                  />
                  <defs>
                    <linearGradient id="cooldownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{
                      color: '#e2e4ed',
                      textShadow: '0 0 20px rgba(99,102,241,0.5)',
                    }}
                  >
                    {cdLeft.toFixed(1)}
                  </span>
                </div>
              </div>

              <div
                className="px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  color: '#8b8fa3',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(99,102,241,0.1)',
                }}
              >
                Cooldown
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
