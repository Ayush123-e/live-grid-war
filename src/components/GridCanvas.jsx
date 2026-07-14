import { useRef, useEffect, useCallback, useState } from 'react'

const GRID_SIZE = 100
const CELL_SIZE = 32
const GRID_TOTAL = GRID_SIZE * CELL_SIZE // 3200px

export default function GridCanvas({ claimedCells, onCellClick, currentUser }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Camera state (using refs for performance — no re-renders on pan/zoom)
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
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  // ---------- resize observer ----------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // center the grid initially
  useEffect(() => {
    if (canvasSize.w && canvasSize.h) {
      cameraRef.current.x = -(GRID_TOTAL / 2 - canvasSize.w / 2)
      cameraRef.current.y = -(GRID_TOTAL / 2 - canvasSize.h / 2)
      cameraRef.current.zoom = Math.min(canvasSize.w / GRID_TOTAL, canvasSize.h / GRID_TOTAL) * 0.9
      draw()
    }
  }, [canvasSize])

  // ---------- drawing ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { zoom, x: camX, y: camY } = cameraRef.current
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // apply DPR + camera
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * camX * zoom, dpr * camY * zoom)

    // visible range (only render what's on screen)
    const startCol = Math.max(0, Math.floor(-camX / CELL_SIZE - 1))
    const endCol = Math.min(GRID_SIZE, Math.ceil((-camX + w / zoom) / CELL_SIZE + 1))
    const startRow = Math.max(0, Math.floor(-camY / CELL_SIZE - 1))
    const endRow = Math.min(GRID_SIZE, Math.ceil((-camY + h / zoom) / CELL_SIZE + 1))

    // draw cell backgrounds
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

        if (claimed) {
          ctx.fillStyle = claimed.color || '#6366f1'
          ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)

          // subtle inner glow for claimed cells
          ctx.shadowColor = claimed.color || '#6366f1'
          ctx.shadowBlur = 6
          ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
          ctx.shadowBlur = 0
        } else if (isHovered) {
          ctx.fillStyle = '#2a2d3e'
          ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
        } else {
          ctx.fillStyle = '#14161f'
          ctx.fillRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
        }
      }
    }

    // grid lines
    ctx.strokeStyle = '#1e2030'
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

    // draw user initials on claimed cells (only when zoomed in enough)
    if (zoom > 0.35) {
      const fontSize = Math.max(8, Math.min(14, CELL_SIZE * 0.4))
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const key = `${col},${row}`
          const claimed = claimedCells?.get(key)
          if (claimed?.label) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)'
            ctx.fillText(
              claimed.label,
              col * CELL_SIZE + CELL_SIZE / 2,
              row * CELL_SIZE + CELL_SIZE / 2
            )
          }
        }
      }
    }

    // hover outline
    if (hoveredCell.current) {
      const { x: hx, y: hy } = hoveredCell.current
      if (hx >= 0 && hx < GRID_SIZE && hy >= 0 && hy < GRID_SIZE) {
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 2
        ctx.strokeRect(
          hx * CELL_SIZE + 1,
          hy * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        )

        // coordinate tooltip at zoom > 0.5
        if (zoom > 0.5) {
          const tooltipText = `(${hx}, ${hy})`
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
  }, [claimedCells])

  // ---------- animation loop ----------
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

  // ---------- set canvas resolution ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvasSize.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.w * dpr
    canvas.height = canvasSize.h * dpr
    canvas.style.width = `${canvasSize.w}px`
    canvas.style.height = `${canvasSize.h}px`
  }, [canvasSize])

  // ---------- screen to grid coords ----------
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

  // ---------- mouse handlers ----------
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
      e.currentTarget.style.cursor = 'crosshair'

      if (!wasDrag) {
        const cell = screenToGrid(e.clientX, e.clientY)
        if (cell && onCellClick) {
          onCellClick(cell.x, cell.y)
        }
      }
    },
    [screenToGrid, onCellClick]
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

    // smooth zoom factor
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

  // prevent default wheel on canvas container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const prevent = (e) => e.preventDefault()
    container.addEventListener('wheel', prevent, { passive: false })
    return () => container.removeEventListener('wheel', prevent)
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      style={{ background: '#0b0d14' }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />

      {/* Minimap / zoom indicator */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: 'rgba(15,17,23,0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(99,102,241,0.12)',
          color: '#8b8fa3',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <span>{Math.round(cameraRef.current.zoom * 100)}%</span>
        <span className="mx-1" style={{ color: '#2a2d3a' }}>|</span>
        <span>Scroll to zoom • Drag to pan</span>
      </div>
    </div>
  )
}
