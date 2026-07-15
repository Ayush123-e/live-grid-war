import { useState, useEffect } from 'react'

export default function Sidebar({ stats, isOpen, onToggle, connected, userProfile, leaderboard }) {
  const [uptimeStr, setUptimeStr] = useState('00:00')

  useEffect(() => {
    const updateUptime = () => {
      if (!stats.serverBootTime) {
        setUptimeStr('00:00')
        return
      }
      const elapsedSec = Math.max(0, Math.floor((Date.now() - stats.serverBootTime) / 1000))
      const h = Math.floor(elapsedSec / 3600)
      const m = Math.floor((elapsedSec % 3600) / 60)
      const s = elapsedSec % 60
      const pad = (n) => String(n).padStart(2, '0')
      
      if (h > 0) {
        setUptimeStr(`${pad(h)}:${pad(m)}:${pad(s)}`)
      } else {
        setUptimeStr(`${pad(m)}:${pad(s)}`)
      }
    }

    updateUptime()
    const timer = setInterval(updateUptime, 1000)
    return () => clearInterval(timer)
  }, [stats.serverBootTime])

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="absolute top-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer pointer-events-auto"
        style={{
          right: isOpen ? '348px' : '16px',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(30, 41, 59, 0.8)',
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

      <aside
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 bottom-4 z-40 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] backdrop-blur-md rounded-xl overflow-hidden pointer-events-auto"
        style={{
          width: '320px',
          transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(30, 41, 59, 0.8)',
          boxShadow: isOpen ? '-10px 10px 40px rgba(0,0,0,0.5)' : 'none',
        }}
      >
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

        {userProfile && (
          <div className="mx-6 mb-2 p-3 rounded-xl flex items-center justify-between"
            style={{
              background: 'rgba(99,102,241,0.04)',
              border: '1px solid rgba(99,102,241,0.08)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black select-none"
                style={{
                  background: `${userProfile.color}22`,
                  color: userProfile.color,
                  border: `1.5px solid ${userProfile.color}44`,
                  boxShadow: `0 0 10px ${userProfile.color}33`,
                }}
              >
                {userProfile.username.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: '#5c5f73' }}>
                  My Identity
                </p>
                <h4 className="text-xs font-semibold truncate" style={{ color: '#e2e4ed' }}>
                  {userProfile.username}
                </h4>
              </div>
            </div>
            <div className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider tabular-nums uppercase"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#8b8fa3',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {userProfile.color}
            </div>
          </div>
        )}

        <div className="mx-6 h-px my-2" style={{ background: 'rgba(99,102,241,0.08)' }} />

        <div className="px-6 py-3 grid grid-cols-2 gap-3">
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
            value={uptimeStr}
            color="#f59e0b"
          />
        </div>

        <div className="mx-6 h-px my-2" style={{ background: 'rgba(99,102,241,0.08)' }} />

        <div className="px-6 py-3 flex-1 overflow-y-auto">
          <h3
            className="text-[10px] font-bold tracking-widest uppercase mb-3"
            style={{ color: '#5c5f73' }}
          >
            Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 border border-dashed rounded-xl"
              style={{
                borderColor: 'rgba(255,255,255,0.05)',
                color: '#5c5f73',
              }}
            >
              <span className="text-xs">No active claims yet</span>
            </div>
          ) : (
            <div className="relative overflow-hidden" style={{ height: `${leaderboard.length * 44}px` }}>
              {leaderboard.map((user, i) => {
                const isCurrentUser = userProfile && user.name === userProfile.username;
                return (
                  <div
                    key={user.id || user.name}
                    className="absolute left-0 right-0 flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                    style={{
                      transform: `translateY(${i * 44}px)`,
                      height: '38px',
                      background: isCurrentUser
                        ? 'rgba(99,102,241,0.08)'
                        : i === 0
                        ? 'rgba(255, 215, 0, 0.03)'
                        : 'transparent',
                      border: isCurrentUser
                        ? '1px solid rgba(99,102,241,0.2)'
                        : i === 0
                        ? '1px solid rgba(255, 215, 0, 0.1)'
                        : '1px solid transparent',
                    }}
                  >
                    <span
                      className="text-xs font-bold w-5 text-center"
                      style={{
                        color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#5c5f73',
                      }}
                    >
                      {i + 1}
                    </span>

                    <div className="relative">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: `${user.color}22`,
                          color: user.color,
                          border: `1.5px solid ${user.color}44`,
                        }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{
                          background: '#22c55e',
                          border: '1.5px solid #0c0e14',
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: isCurrentUser ? '#fff' : '#e2e4ed' }}
                      >
                        {user.name} {isCurrentUser && <span className="text-[9px] opacity-75 font-semibold">(You)</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: user.color,
                          boxShadow: `0 0 6px ${user.color}`,
                        }}
                      />
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: '#8b8fa3' }}
                      >
                        {user.cells}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4"
          style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
        >
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: connected ? 'rgba(99,102,241,0.06)' : 'rgba(239,68,68,0.06)',
              color: connected ? '#6366f1' : '#ef4444',
              border: `1px solid ${connected ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)'}`,
            }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`}
              style={{
                background: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected
                  ? '0 0 6px rgba(34,197,94,0.5)'
                  : '0 0 6px rgba(239,68,68,0.5)',
              }}
            />
            {connected ? 'Connected to server' : 'Disconnected'}
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
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(30, 41, 59, 0.6)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.7)'
        e.currentTarget.style.borderColor = `${color}44`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)'
        e.currentTarget.style.borderColor = 'rgba(30, 41, 59, 0.6)'
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
