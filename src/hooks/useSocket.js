/**
 * useSocket — Custom hook for Socket.io connection management.
 *
 * Handles connection lifecycle, grid state sync, delta updates,
 * rollback events, cooldown errors, and live user count.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [gridSize, setGridSize] = useState(100)

  // Grid state as a Map — updated in-place via delta events
  const [claimedCells, setClaimedCells] = useState(() => new Map())

  // Pulse trigger ref — set by App, called by socket events
  const triggerPulseRef = useRef(null)

  // ── Connect on mount ──
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })
    socketRef.current = socket

    // -- Connection state --
    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason)
      setConnected(false)
    })

    // -- Initial grid state --
    socket.on('grid:init', (data) => {
      console.log(`[WS] Grid init: ${data.cells.length} cells, ${data.onlineUsers} online`)
      setGridSize(data.gridSize)
      setOnlineUsers(data.onlineUsers)

      // Build the Map from server's sparse cell array
      const map = new Map()
      for (const cell of data.cells) {
        const key = `${cell.x},${cell.y}`
        map.set(key, {
          color: cell.color,
          label: cell.owner?.slice(-2)?.toUpperCase() || '?',
          owner: cell.owner,
        })
      }
      setClaimedCells(map)
    })

    // -- Delta update: a single cell was claimed by someone --
    socket.on('cell-updated', (cell) => {
      setClaimedCells((prev) => {
        const next = new Map(prev)
        const key = `${cell.x},${cell.y}`
        const existing = next.get(key)

        // If this is OUR optimistic cell being confirmed, remove optimistic flag
        // and trigger pulse; otherwise just set the new cell data
        const isOurs = existing?.optimistic && cell.owner === socket.id

        next.set(key, {
          color: cell.color,
          label: cell.owner?.slice(-2)?.toUpperCase() || '?',
          owner: cell.owner,
          optimistic: false,
        })

        // Trigger pulse for confirmed claims (ours or others')
        if (triggerPulseRef.current) {
          triggerPulseRef.current(cell.x, cell.y, cell.color)
        }

        return next
      })
    })

    // -- Sync rollback: our optimistic claim was rejected (conflict / lock) --
    socket.on('sync-rollback', (data) => {
      console.log(`[WS] Rollback: (${data.x},${data.y}) — ${data.reason}`)

      setClaimedCells((prev) => {
        const next = new Map(prev)
        const key = `${data.x},${data.y}`
        const existing = next.get(key)

        // Only rollback if it's still our optimistic cell
        if (existing?.optimistic) {
          if (data.currentCell) {
            // Replace with the actual owner's data
            next.set(key, {
              color: data.currentCell.color,
              label: data.currentCell.owner?.slice(-2)?.toUpperCase() || '?',
              owner: data.currentCell.owner,
              optimistic: false,
            })
          } else {
            // No current owner — just remove
            next.delete(key)
          }
        }

        return next
      })
    })

    // -- Cooldown error --
    socket.on('error-cooldown', (data) => {
      console.warn(`[WS] Cooldown: ${data.reason}`)
      // Rollback the optimistic cell for the blocked claim
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

    // -- Live user count --
    socket.on('user-count', (data) => {
      setOnlineUsers(data.onlineUsers)
    })

    // Cleanup
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // ── Claim a cell via socket (with optimistic UI) ──
  const claimCell = useCallback((x, y, color) => {
    const socket = socketRef.current
    if (!socket?.connected) return

    // Emit with acknowledgement callback
    socket.emit('claim-cell', { x, y, color }, (response) => {
      if (!response.success) {
        console.warn(`[WS] Claim rejected: ${response.reason}`)
        // Rollback if the ack says failure (belt-and-suspenders with sync-rollback)
        setClaimedCells((prev) => {
          const next = new Map(prev)
          const key = `${x},${y}`
          const existing = next.get(key)
          if (existing?.optimistic) {
            if (response.currentCell) {
              next.set(key, {
                color: response.currentCell.color,
                label: response.currentCell.owner?.slice(-2)?.toUpperCase() || '?',
                owner: response.currentCell.owner,
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
    claimedCells,
    setClaimedCells,
    claimCell,
    triggerPulseRef,
  }
}
