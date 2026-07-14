import { useRef, useEffect, useCallback, useState, useMemo } from 'react'

const GRID_SIZE = 100
const CELL_SIZE = 32
const GRID_TOTAL = GRID_SIZE * CELL_SIZE // 3200px

// Pulse animation config
const PULSE_DURATION = 900 // ms
const PULSE_MAX_RADIUS = CELL_SIZE * 1.8

/**
 * Perform smooth linear interpolation between colors to generate thermal gradient.
 * @param {number} ratio — normalized click value [0.0 - 1.0]
 * @returns {string} — rgb color string
 */
function getHeatmapColor(ratio) {
  // 0.00 -> #10121a (very dark navy)
  // 0.25 -> #4c1d95 (rich purple)
  // 0.50 -> #b91c1c (deep red)
  // 0.75 -> #ea580c (neon orange)
  // 1.00 -> #ffffff (bright white)
  let r, g, b;
  if (ratio < 0.25) {
    const t = ratio / 0.25;
    r = Math.round(16 + t * (76 - 16));
    g = Math.round(18 + t * (29 - 18));
    b = Math.round(26 + t * (149 - 26));
  } else if (ratio < 0.5) {
    const t = (ratio - 0.25) / 0.25;
    r = Math.round(76 + t * (185 - 76));
    g = Math.round(29 + t * (28 - 29));
    b = Math.round(149 + t * (28 - 149));
  } else if (ratio < 0.75) {
    const t = (ratio - 0.5) / 0.25;
    r = Math.round(185 + t * (234 - 185));
    g = Math.round(28 + t * (88 - 28));
    b = Math.round(28 + t * (12 - 28));
  } else {
    const t = (ratio - 0.75) / 0.25;
    r = Math.round(234 + t * (255 - 234));
    g = Math.round(88 + t * (255 - 88));
    b = Math.round(12 + t * (255 - 12));
  }
  return `rgb(${r},${g},${b})`;
}

export default function GridCanvas({
  claimedCells,
  clickCounts,
  onCellClick,
  currentUser,
  cooldownActive,
  cooldownRemaining,
  heatmapMode
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const cameraRef = useRef({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const lastCameraPos = useRef({ x: 0, y: 0 })
  const hoveredCell = useRef(null)
  const animFrameRef = useRef(null)

  const pulsesRef = useRef([])

  const hasCentered = useRef(false)

  const maxClicks = useMemo(() => {
    let max = 5
    if (clickCounts) {
      for (const count of clickCounts.values()) {
        if (count > max) max = count
      }
    }
    return max
  }, [clickCounts])

  const triggerPulse = useCallback((col, row, color) => {
    pulsesRef.current.push({
      col,
      row,
      color,
      startTime: performance.now(),
    })
  }, [])

  const triggerPulseRef = useRef(triggerPulse)
  triggerPulseRef.current = triggerPulse

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { zoom, x: camX, y: camY } = cameraRef.current
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const now = performance.now()

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // apply DPR + camera
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * camX * zoom, dpr * camY * zoom)

    // visible range (only render what's on screen)
    const startCol = Math.max(0, Math.floor(-camX / CELL_SIZE - 1))
    const endCol = Math.min(GRID_SIZE, Math.ceil((-camX + w / zoom) / CELL_SIZE + 1))
    const startRow = Math.max(0, Math.floor(-camY / CELL_SIZE - 1))
    const endRow = Math.min(GRID_SIZE, Math.ceil((-camY + h / zoom) / CELL_SIZE + 1))

    // 1. Draw dynamic grid lines overlay first (underneath cell blocks)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.3)'
    ctx.lineWidth = 0.5
    for (let col = startCol; col <= endCol; col++) {
      ctx.beginPath()
      ctx.moveTo(col * CELL_SIZE, startRow * CELL_SIZE)
      ctx.lineTo(col * CELL_SIZE, endRow * CELL_SIZE)
      ctx.stroke()
    }
    for (let row = startRow; row <= endRow; row++) {
      ctx.beginPath()
      ctx.moveTo(startCol * CELL_SIZE, row * CELL_SIZE)
      ctx.lineTo(endCol * CELL_SIZE, row * CELL_SIZE)
      ctx.stroke()
    }

    // 2. Draw claimed cells, highlights, and analytics on top of the grid lines
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = `${col},${row}`
        const claimed = claimedCells?.get(key)
        const isHovered =
          hoveredCell.current &&
          hoveredCell.current.x === col &&
          hoveredCell.current.y === row

        const px = col * CELL_SIZE
        const py = row * CELL_SIZE

        if (heatmapMode) {
          const count = clickCounts?.get(key) || 0
          if (count > 0) {
            const ratio = Math.min(1, count / maxClicks)
            ctx.fillStyle = getHeatmapColor(ratio)
            ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

            // draw subtle layout borders for claimed cells in heatmap
            if (claimed) {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
              ctx.lineWidth = 0.5
              ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
            }
          }
        } else {
          if (claimed) {
            // Draw claimed block base
            ctx.fillStyle = claimed.color || '#6366f1'
            ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

            // Subtle inner glow for claimed cells
            ctx.shadowColor = claimed.color || '#6366f1'
            ctx.shadowBlur = 6
            ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
            ctx.shadowBlur = 0

            if (zoom >= 0.5) {
              const ownerName = claimed.ownerName || claimed.owner || "Anonymous";

              let displayInitials = "";
              if (ownerName.includes('_')) {
                const parts = ownerName.split('_');
                displayInitials = (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1])).toUpperCase();
              } else if (ownerName.includes(' ')) {
                const parts = ownerName.split(' ');
                displayInitials = (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1])).toUpperCase();
              } else {
                displayInitials = ownerName.substring(0, 2).toUpperCase();
              }

              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 10px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(displayInitials, px + CELL_SIZE / 2, py + CELL_SIZE / 2);
            }

            if (claimed.optimistic) {
              ctx.strokeStyle = 'rgba(255,255,255,0.4)'
              ctx.lineWidth = 1.5
              ctx.setLineDash([3, 3])
              ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2)
              ctx.setLineDash([])
            }
          } else if (isHovered && !cooldownActive) {
            ctx.fillStyle = '#2a2d3e'
            ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
          }
        }
      }
    }

    const activePulses = []
    for (const pulse of pulsesRef.current) {
      const elapsed = now - pulse.startTime
      if (elapsed >= PULSE_DURATION) continue
      activePulses.push(pulse)

      const t = elapsed / PULSE_DURATION
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const radius = PULSE_MAX_RADIUS * eased
      const opacity = 1 - eased

      const cx = pulse.col * CELL_SIZE + CELL_SIZE / 2
      const cy = pulse.row * CELL_SIZE + CELL_SIZE / 2

      // outer glow ring
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = pulse.color
      ctx.lineWidth = 2.5 * (1 - t)
      ctx.globalAlpha = opacity * 0.7
      ctx.stroke()
      ctx.globalAlpha = 1

      // inner radial glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.6)
      grad.addColorStop(0, `${pulse.color}${Math.round(opacity * 40).toString(16).padStart(2, '0')}`)
      grad.addColorStop(1, `${pulse.color}00`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2)
      ctx.fill()

      if (t < 0.3) {
        const flashOpacity = (1 - t / 0.3)
        ctx.globalAlpha = flashOpacity * 0.6
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(cx, cy, CELL_SIZE * 0.35 * (1 - t), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    pulsesRef.current = activePulses

    if (hoveredCell.current && !cooldownActive) {
      const { x: hx, y: hy } = hoveredCell.current
      if (hx >= 0 && hx < GRID_SIZE && hy >= 0 && hy < GRID_SIZE) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.fillRect(hx * CELL_SIZE + 0.5, hy * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(hx * CELL_SIZE + 0.5, hy * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

        if (zoom > 0.5) {
          const clicksText = heatmapMode ? ` | Clicks: ${clickCounts?.get(`${hx},${hy}`) || 0}` : ''
          const tooltipText = `(${hx}, ${hy})${clicksText}`
          ctx.font = '500 10px Inter, system-ui, sans-serif'
          const metrics = ctx.measureText(tooltipText)
          const tw = metrics.width + 10
          const th = 18
          const tx = hx * CELL_SIZE + CELL_SIZE / 2 - tw / 2
          const ty = hy * CELL_SIZE - th - 4

          ctx.fillStyle = 'rgba(99, 102, 241, 0.9)'
          ctx.beginPath()
          ctx.roundRect(tx, ty, tw, th, 4)
          ctx.fill()

          ctx.fillStyle = '#fff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(tooltipText, hx * CELL_SIZE + CELL_SIZE / 2, ty + th / 2)
        }
      }
    }
  }, [claimedCells, clickCounts, maxClicks, cooldownActive, heatmapMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      draw()
    }

    if (!hasCentered.current) {
      cameraRef.current.zoom = 1.0
      cameraRef.current.x = (window.innerWidth - (GRID_SIZE * CELL_SIZE)) / 2
      cameraRef.current.y = (window.innerHeight - (GRID_SIZE * CELL_SIZE)) / 2
      hasCentered.current = true
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      running = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [draw])

  const screenToGrid = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { zoom, x: camX, y: camY } = cameraRef.current

    const worldX = (clientX - rect.left) / zoom - camX
    const worldY = (clientY - rect.top) / zoom - camY

    const col = Math.floor(worldX / CELL_SIZE)
    const row = Math.floor(worldY / CELL_SIZE)

    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
      return { x: col, y: row }
    }
    return null
  }, [])

  const handleMouseDown = useCallback((e) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    lastCameraPos.current = { x: cameraRef.current.x, y: cameraRef.current.y }
    e.currentTarget.style.cursor = 'grabbing'
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      cameraRef.current.x = lastCameraPos.current.x + dx / cameraRef.current.zoom
      cameraRef.current.y = lastCameraPos.current.y + dy / cameraRef.current.zoom
    }

    const cell = screenToGrid(e.clientX, e.clientY)
    hoveredCell.current = cell
  }, [screenToGrid])

  const handleMouseUp = useCallback(
    (e) => {
      const wasDrag =
        Math.abs(e.clientX - dragStart.current.x) > 3 ||
        Math.abs(e.clientY - dragStart.current.y) > 3

      isDragging.current = false
      e.currentTarget.style.cursor = cooldownActive ? 'not-allowed' : 'crosshair'

      if (!wasDrag && !cooldownActive) {
        const cell = screenToGrid(e.clientX, e.clientY)
        if (cell && onCellClick) {
          onCellClick(cell.x, cell.y, triggerPulseRef.current)
        }
      }
    },
    [screenToGrid, onCellClick, cooldownActive]
  )

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    hoveredCell.current = null
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const cam = cameraRef.current
    const oldZoom = cam.zoom

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    cam.zoom = Math.max(0.1, Math.min(5, cam.zoom * zoomFactor))

    // zoom towards mouse pointer
    const worldXBefore = mouseX / oldZoom - cam.x
    const worldYBefore = mouseY / oldZoom - cam.y
    const worldXAfter = mouseX / cam.zoom - cam.x
    const worldYAfter = mouseY / cam.zoom - cam.y

    cam.x += worldXAfter - worldXBefore
    cam.y += worldYAfter - worldYBefore
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('wheel', prevent, { passive: false })
    return () => canvas.removeEventListener('wheel', prevent)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0 block bg-[#0b0f19]"
      style={{ cursor: cooldownActive ? 'not-allowed' : 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  )
}
