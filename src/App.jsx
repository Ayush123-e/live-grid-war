import { useState, useCallback } from 'react'
import GridCanvas from './components/GridCanvas'
import Sidebar from './components/Sidebar'

// Color palette for users
const COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899']

function App() {
  const [claimedCells, setClaimedCells] = useState(() => {
    // seed some demo cells
    const map = new Map()
    const demoData = [
      { x: 48, y: 48, color: '#6366f1', label: 'A' },
      { x: 49, y: 48, color: '#6366f1', label: 'A' },
      { x: 50, y: 48, color: '#f43f5e', label: 'P' },
      { x: 48, y: 49, color: '#22c55e', label: 'R' },
      { x: 49, y: 49, color: '#6366f1', label: 'A' },
      { x: 50, y: 49, color: '#f43f5e', label: 'P' },
      { x: 51, y: 49, color: '#f59e0b', label: 'S' },
      { x: 48, y: 50, color: '#22c55e', label: 'R' },
      { x: 49, y: 50, color: '#22c55e', label: 'R' },
      { x: 50, y: 50, color: '#06b6d4', label: 'V' },
      { x: 51, y: 50, color: '#f59e0b', label: 'S' },
      { x: 51, y: 48, color: '#06b6d4', label: 'V' },
    ]
    demoData.forEach(({ x, y, color, label }) => {
      map.set(`${x},${y}`, { color, label })
    })
    return map
  })

  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleCellClick = useCallback(
    (x, y) => {
      const key = `${x},${y}`
      setClaimedCells((prev) => {
        const next = new Map(prev)
        if (next.has(key)) {
          // unclaim
          next.delete(key)
        } else {
          // claim with random color
          const color = COLORS[Math.floor(Math.random() * COLORS.length)]
          next.set(key, { color, label: 'U' })
        }
        return next
      })
    },
    []
  )

  const stats = {
    onlineUsers: 3,
    cellsClaimed: claimedCells.size,
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: '#0b0d14' }}>
      {/* Grid Canvas fills the entire viewport */}
      <GridCanvas
        claimedCells={claimedCells}
        onCellClick={handleCellClick}
        currentUser="U"
      />

      {/* Floating Sidebar */}
      <Sidebar
        stats={stats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
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
          className="ml-2 w-1.5 h-1.5 rounded-full animate-pulse"
          style={{
            background: '#22c55e',
            boxShadow: '0 0 8px rgba(34,197,94,0.6)',
          }}
        />
      </div>
    </div>
  )
}

export default App
