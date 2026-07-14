/**
 * GridStore — In-memory grid state management.
 *
 * Uses a flat Map<string, CellData> keyed by "x,y" for O(1) lookups.
 * A 2D array would waste memory since most cells are empty; a Map
 * only stores claimed cells, keeping the footprint minimal.
 */

const GRID_SIZE = 100

class GridStore {
  constructor() {
    /** @type {Map<string, { x: number, y: number, color: string, owner: string }>} */
    this.cells = new Map()
  }

  /**
   * Validate that coordinates are within the grid bounds.
   * @param {number} x
   * @param {number} y
   * @returns {{ valid: boolean, reason?: string }}
   */
  validate(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return { valid: false, reason: 'Coordinates must be integers' }
    }
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return { valid: false, reason: `Coordinates out of bounds (0-${GRID_SIZE - 1})` }
    }
    return { valid: true }
  }

  /**
   * Claim a cell. Returns the cell data on success, or null if validation fails.
   * @param {number} x
   * @param {number} y
   * @param {string} color  — hex color string
   * @param {string} owner  — socket id or username
   * @returns {{ success: boolean, cell?: object, reason?: string }}
   */
  claimCell(x, y, color, owner) {
    const check = this.validate(x, y)
    if (!check.valid) {
      return { success: false, reason: check.reason }
    }

    // Validate color is a reasonable hex string
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return { success: false, reason: 'Invalid color format (expected #RRGGBB)' }
    }

    const key = `${x},${y}`
    const cell = { x, y, color, owner }
    this.cells.set(key, cell)

    return { success: true, cell }
  }

  /**
   * Get a specific cell.
   * @param {number} x
   * @param {number} y
   * @returns {object|null}
   */
  getCell(x, y) {
    return this.cells.get(`${x},${y}`) || null
  }

  /**
   * Serialize the entire grid state for initial sync.
   * Returns only claimed cells (sparse), not all 10,000.
   * @returns {Array<{ x: number, y: number, color: string, owner: string }>}
   */
  getFullState() {
    return Array.from(this.cells.values())
  }

  /**
   * Get the count of claimed cells.
   * @returns {number}
   */
  get claimedCount() {
    return this.cells.size
  }

  /**
   * Grid dimensions (for client reference).
   */
  get size() {
    return GRID_SIZE
  }
}

module.exports = GridStore
