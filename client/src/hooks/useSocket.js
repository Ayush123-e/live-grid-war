/**
 * useSocket — Custom hook for Socket.io connection management.
 *
 * Handles connection lifecycle, grid state sync, delta updates,
 * rollback events, cooldown errors, live user count, dynamic leaderboard,
 * and user profile info.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { getInitials } from '../utils/initials'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [gridSize, setGridSize] = useState(100)
  const [userProfile, setUserProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  // Grid states
  const [claimedCells, setClaimedCells] = useState(() => new Map())
  const [clickCounts, setClickCounts] = useState(() => new Map())

  // Pulse trigger ref — set by App, called by socket events
  const triggerPulseRef = useRef(null)

  // ── Connect on mount ──
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
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason)
      setConnected(false)
    })

    socket.on('user:profile', (profile) => {
      setUserProfile(profile)
      localStorage.setItem('live-grid-war:profile', JSON.stringify(profile))
    })

    socket.on('leaderboard:update', (top5) => {
      setLeaderboard(top5)
    })

    socket.on('grid:init', (data) => {
      console.log(`[WS] Grid init: ${data.cells.length} cells, ${data.onlineUsers} online`)
      setGridSize(data.gridSize)
      setOnlineUsers(data.onlineUsers)
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard)
      }

      const map = new Map()
      for (const cell of data.cells) {
        const key = `${cell.x},${cell.y}`
        map.set(key, {
          color: cell.color,
          label: getInitials(cell.ownerName || cell.owner),
          owner: cell.owner,
          ownerName: cell.ownerName || cell.owner,
        })
      }
      setClaimedCells(map)

      const clicks = new Map(Object.entries(data.clickHistory || {}))
      setClickCounts(clicks)
    })

    socket.on('cell-updated', (cell) => {
      setClaimedCells((prev) => {
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

          if (triggerPulseRef.current) {
            triggerPulseRef.current(cell.x, cell.y, cell.color)
          }
        }
        return next
      })

      if (cell.clickCount !== undefined) {
        setClickCounts((prev) => {
          const next = new Map(prev)
          const key = `${cell.x},${cell.y}`
          next.set(key, cell.clickCount)
          return next
        })
      }
    })

    socket.on('sync-rollback', (data) => {
      console.log(`[WS] Rollback: (${data.x},${data.y}) — ${data.reason}`)

      setClaimedCells((prev) => {
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
        setClickCounts((prev) => {
          const next = new Map(prev)
          const key = `${data.x},${data.y}`
          next.set(key, data.clickCount)
          return next
        })
      }
    })

    socket.on('error-cooldown', (data) => {
      console.warn(`[WS] Cooldown: ${data.reason}`)
      if (data.cell) {
        setClaimedCells((prev) => {
          const next = new Map(prev)
          const key = `${data.cell.x},${data.cell.y}`
          const existing = next.get(key)
          if (existing?.optimistic) {
            next.delete(key)
          }
          return next
        })
      }
    })

    socket.on('user-count', (data) => {
      setOnlineUsers(data.onlineUsers)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const claimCell = useCallback((x, y) => {
    const socket = socketRef.current
    if (!socket?.connected) return

    socket.emit('claim-cell', { x, y }, (response) => {
      if (!response.success) {
        console.warn(`[WS] Claim rejected: ${response.reason}`)
        setClaimedCells((prev) => {
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
    socket: socketRef,
    connected,
    onlineUsers,
    gridSize,
    userProfile,
    leaderboard,
    claimedCells,
    clickCounts,
    setClaimedCells,
    claimCell,
    triggerPulseRef,
  }
}
