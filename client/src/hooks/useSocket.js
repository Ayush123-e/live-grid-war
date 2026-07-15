import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { getInitials } from '../utils/initials'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function useSocket() {
  const ws = useRef(null)
  const [connected, setConnected] = useState(false)
  const [usersOnline, setUsersOnline] = useState(0)
  const [gridSize, setGridSize] = useState(100)
  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [cells, setCells] = useState(() => new Map())
  const [clicks, setClicks] = useState(() => new Map())
  const onPulse = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('live-grid-war:profile')
    const authData = saved ? JSON.parse(saved) : null

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      auth: authData ? { profile: authData } : {},
    })
    ws.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason)
      setConnected(false)
    })

    socket.on('user:profile', (p) => {
      setProfile(p)
      localStorage.setItem('live-grid-war:profile', JSON.stringify(p))
    })

    socket.on('leaderboard:update', setLeaderboard)

    socket.on('grid:init', (data) => {
      console.log(`[WS] Grid init: ${data.cells.length} cells, ${data.onlineUsers} online`)
      setGridSize(data.gridSize)
      setUsersOnline(data.onlineUsers)
      if (data.leaderboard) setLeaderboard(data.leaderboard)

      const map = new Map()
      for (const cell of data.cells) {
        map.set(`${cell.x},${cell.y}`, {
          color: cell.color,
          label: getInitials(cell.ownerName || cell.owner),
          owner: cell.owner,
          ownerName: cell.ownerName || cell.owner,
        })
      }
      setCells(map)

      setClicks(new Map(Object.entries(data.clickHistory || {})))
    })

    socket.on('cell-updated', (cell) => {
      setCells((prev) => {
        const next = new Map(prev)
        const key = `${cell.x},${cell.y}`

        if (cell.color === null) {
          next.delete(key)
        } else {
          next.set(key, {
            color: cell.color,
            label: getInitials(cell.ownerName || cell.owner),
            owner: cell.owner,
            ownerName: cell.ownerName || cell.owner,
            optimistic: false,
          })

          if (onPulse.current) {
            onPulse.current(cell.x, cell.y, cell.color)
          }
        }
        return next
      })

      if (cell.clickCount !== undefined) {
        setClicks((prev) => {
          const next = new Map(prev)
          next.set(`${cell.x},${cell.y}`, cell.clickCount)
          return next
        })
      }
    })

    socket.on('sync-rollback', (data) => {
      console.log(`[WS] Rollback: (${data.x},${data.y}) — ${data.reason}`)

      setCells((prev) => {
        const next = new Map(prev)
        const key = `${data.x},${data.y}`
        const existing = next.get(key)

        if (existing?.optimistic) {
          if (data.currentCell) {
            next.set(key, {
              color: data.currentCell.color,
              label: getInitials(data.currentCell.ownerName || data.currentCell.owner),
              owner: data.currentCell.owner,
              ownerName: data.currentCell.ownerName || data.currentCell.owner,
              optimistic: false,
            })
          } else {
            next.delete(key)
          }
        }
        return next
      })

      if (data.clickCount !== undefined) {
        setClicks((prev) => {
          const next = new Map(prev)
          next.set(`${data.x},${data.y}`, data.clickCount)
          return next
        })
      }
    })

    socket.on('error-cooldown', (data) => {
      console.warn(`[WS] Cooldown: ${data.reason}`)
      if (data.cell) {
        setCells((prev) => {
          const next = new Map(prev)
          const key = `${data.cell.x},${data.cell.y}`
          if (next.get(key)?.optimistic) {
            next.delete(key)
          }
          return next
        })
      }
    })

    socket.on('user-count', (data) => {
      setUsersOnline(data.onlineUsers)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      ws.current = null
    }
  }, [])

  const claimCell = useCallback((x, y) => {
    const socket = ws.current
    if (!socket?.connected) return

    socket.emit('claim-cell', { x, y }, (response) => {
      if (!response.success) {
        console.warn(`[WS] Claim rejected: ${response.reason}`)
        setCells((prev) => {
          const next = new Map(prev)
          const key = `${x},${y}`
          const existing = next.get(key)
          if (existing?.optimistic) {
            if (response.currentCell) {
              next.set(key, {
                color: response.currentCell.color,
                label: getInitials(response.currentCell.ownerName || response.currentCell.owner),
                owner: response.currentCell.owner,
                ownerName: response.currentCell.ownerName || response.currentCell.owner,
                optimistic: false,
              })
            } else {
              next.delete(key)
            }
          }
          return next
        })
      }
    })
  }, [])

  return {
    socket: ws,
    connected,
    usersOnline,
    gridSize,
    profile,
    leaderboard,
    cells,
    clicks,
    setCells,
    claimCell,
    onPulse,
  }
}
