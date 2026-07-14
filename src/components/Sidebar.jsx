import { useState, useEffect } from 'react'

const MOCK_USERS = [
  { id: 1, name: 'Ayush K.', color: '#6366f1', cells: 42, online: true },
  { id: 2, name: 'Priya S.', color: '#f43f5e', cells: 38, online: true },
  { id: 3, name: 'Rahul M.', color: '#22c55e', cells: 27, online: false },
  { id: 4, name: 'Sneha D.', color: '#f59e0b', cells: 19, online: true },
  { id: 5, name: 'Vikram P.', color: '#06b6d4', cells: 15, online: false },
]

export default function Sidebar({ stats, isOpen, onToggle }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300"
        style={{
          background: 'rgba(15,17,23,0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,102,241,0.15)',
          color: '#8b8fa3',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
        aria-label="Toggle sidebar"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.3s ease',
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Sidebar panel */}
      <aside
        className="fixed top-0 right-0 h-full z-40 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: '320px',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          background: 'rgba(12,14,20,0.88)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          borderLeft: '1px solid rgba(99,102,241,0.08)',
          boxShadow: isOpen ? '-20px 0 60px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#e2e4ed' }}>
                Grid War
              </h2>
              <p className="text-[10px] font-medium" style={{ color: '#5c5f73' }}>
                LIVE SESSION
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px" style={{ background: 'rgba(99,102,241,0.08)' }} />

        {/* Stats cards */}
        <div className="px-6 py-5 grid grid-cols-2 gap-3">
          <StatCard
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            label="Online"
            value={stats.onlineUsers}
            color="#22c55e"
            pulse
          />
          <StatCard
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
            label="Claimed"
            value={stats.cellsClaimed}
            color="#6366f1"
          />
          <StatCard
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            }
            label="Total Cells"
            value="10,000"
            color="#8b8fa3"
          />
          <StatCard
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            label="Uptime"
            value={time.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
            color="#f59e0b"
          />
        </div>

        {/* Divider */}
        <div className="mx-6 h-px" style={{ background: 'rgba(99,102,241,0.08)' }} />

        {/* Leaderboard */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <h3
            className="text-[10px] font-bold tracking-widest uppercase mb-3"
            style={{ color: '#5c5f73' }}
          >
            Leaderboard
          </h3>
          <div className="space-y-1.5">
            {MOCK_USERS.sort((a, b) => b.cells - a.cells).map((user, i) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200"
                style={{
                  background: i === 0 ? 'rgba(99,102,241,0.06)' : 'transparent',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    i === 0 ? 'rgba(99,102,241,0.06)' : 'transparent')
                }
              >
                {/* Rank */}
                <span
                  className="text-xs font-bold w-5 text-center"
                  style={{
                    color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#5c5f73',
                  }}
                >
                  {i + 1}
                </span>

                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: `${user.color}22`,
                      color: user.color,
                      border: `1.5px solid ${user.color}44`,
                    }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  {user.online && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                      style={{
                        background: '#22c55e',
                        border: '2px solid #0c0e14',
                        boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                      }}
                    />
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: '#e2e4ed' }}
                  >
                    {user.name}
                  </p>
                </div>

                {/* Cell count */}
                <div className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ background: user.color }}
                  />
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: '#8b8fa3' }}
                  >
                    {user.cells}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4"
          style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
        >
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: 'rgba(99,102,241,0.06)',
              color: '#6366f1',
              border: '1px solid rgba(99,102,241,0.1)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }}
            />
            Connected to server
          </div>
        </div>
      </aside>
    </>
  )
}

function StatCard({ icon, label, value, color, pulse }) {
  return (
    <div
      className="p-3 rounded-xl transition-all duration-200"
      style={{
        background: 'rgba(22,24,34,0.6)',
        border: '1px solid rgba(99,102,241,0.06)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(22,24,34,0.9)'
        e.currentTarget.style.borderColor = `${color}22`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(22,24,34,0.6)'
        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.06)'
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: '#5c5f73' }}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {pulse && (
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: color, boxShadow: `0 0 8px ${color}88` }}
          />
        )}
        <span className="text-lg font-bold tabular-nums" style={{ color: '#e2e4ed' }}>
          {value}
        </span>
      </div>
    </div>
  )
}
