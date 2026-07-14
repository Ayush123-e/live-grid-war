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
    /** @type {Map<string, { x: number, y: number, color: string, owner: string, claimedAt: number }>} */
    this.cells = new Map()

    /**
     * Per-cell lock set to guarantee sequential processing.
     * While a cell key is in this Set, any other claim to that
     * same cell will wait (spin) until the lock is released.
     * In Node's single-threaded model this acts as a logical
     * mutex — since we resolve synchronously, the Set prevents
     * re-entrant claims within the same tick via queued microtasks.
     * @type {Set<string>}
     */
    this.locks = new Set()
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
   * Validate that a color string is a proper hex color.
   * @param {string} color
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateColor(color) {
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return { valid: false, reason: 'Invalid color format (expected #RRGGBB)' }
    }
    return { valid: true }
  }

  /**
   * Acquire a lock on a cell key. Returns true if acquired, false if
   * the cell is already locked (another claim is in-flight).
   * @param {string} key
   * @returns {boolean}
   */
  acquireLock(key) {
    if (this.locks.has(key)) return false
    this.locks.add(key)
    return true
  }

  /**
   * Release the lock on a cell key.
   * @param {string} key
   */
  releaseLock(key) {
    this.locks.delete(key)
  }

  /**
   * Attempt to claim a cell with conflict detection.
   *
   * Returns one of three outcomes:
   *   - { status: 'claimed', cell }          → success, cell was free or self-owned
   *   - { status: 'conflict', currentOwner } → cell is owned by someone else
   *   - { status: 'error', reason }          → validation failure
   *   - { status: 'locked' }                 → cell is being processed by another request
   *
   * @param {number} x
   * @param {number} y
   * @param {string} color  — hex color string
   * @param {string} owner  — socket id
   * @returns {{ status: string, cell?: object, currentOwner?: object, reason?: string }}
   */
  tryClaimCell(x, y, color, owner) {
    // Validate inputs
    const coordCheck = this.validate(x, y)
    if (!coordCheck.valid) {
      return { status: 'error', reason: coordCheck.reason }
    }
    const colorCheck = this.validateColor(color)
    if (!colorCheck.valid) {
      return { status: 'error', reason: colorCheck.reason }
    }

    const key = `${x},${y}`

    // Try to acquire cell-level lock
    if (!this.acquireLock(key)) {
      return { status: 'locked' }
    }

    try {
      const existing = this.cells.get(key)

      // Conflict: cell is already claimed by a different owner
      if (existing && existing.owner !== owner) {
        return {
          status: 'conflict',
          currentOwner: existing,
        }
      }

      // Claim the cell (or re-claim own cell with new color)
      const cell = {
        x,
        y,
        color,
        owner,
        claimedAt: Date.now(),
      }
      this.cells.set(key, cell)

      return { status: 'claimed', cell }
    } finally {
      // Always release the lock
      this.releaseLock(key)
    }
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
