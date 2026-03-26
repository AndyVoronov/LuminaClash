import { PlayerLight } from '../entities/PlayerLight';
import { GridSystem } from '../systems/GridSystem';
import { ObstacleSystem } from '../systems/ObstacleSystem';
import { CELL_STATE, CELL_SIZE } from '../config';

type BotState = 'EXPAND' | 'ATTACK' | 'DEFEND' | 'CLEANSE' | 'RETREAT';

interface ScanResult {
  unclaimed: { cx: number; cy: number; dist: number }[];
  enemyCells: { cx: number; cy: number; dist: number; ownerId: string }[];
  myEdge: { cx: number; cy: number; dist: number }[];
  nearbyEnemies: { id: string; wx: number; wy: number; dist: number }[];
  myCellCount: number;
  totalScanCells: number;
}

export class BotAI {
  private bot: PlayerLight;
  private grid: GridSystem;
  private obstacles: ObstacleSystem;
  private reactionDelay: number;
  private lastDecisionTime: number = -Infinity;
  private state: BotState = 'EXPAND';
  private targetX: number = 0;
  private targetY: number = 0;
  private stateTimer: number = 0;
  private allLights: PlayerLight[];

  // Scan radius in cells — only look this far for decisions
  private readonly SCAN_RADIUS = 12;

  constructor(
    bot: PlayerLight,
    grid: GridSystem,
    obstacles: ObstacleSystem,
    reactionDelay: number,
    allLights: PlayerLight[],
  ) {
    this.bot = bot;
    this.grid = grid;
    this.obstacles = obstacles;
    this.reactionDelay = reactionDelay;
    this.allLights = allLights;
    this.targetX = bot.wx;
    this.targetY = bot.wy;
  }

  update(time: number, delta: number, offsetX: number, offsetY: number): void {
    this.stateTimer += delta;

    if (time - this.lastDecisionTime >= this.reactionDelay) {
      this.lastDecisionTime = time;
      this.decideAndPickTarget(offsetX, offsetY);
    }

    this.moveTowardsTarget();
  }

  private decideAndPickTarget(offsetX: number, offsetY: number): void {
    const scan = this.scanArea(offsetX, offsetY);
    const totalCells = this.grid.getTotalCells();
    const myPercent = totalCells > 0 ? (scan.myCellCount / totalCells) * 100 : 0;

    // Strategic obstacle placement — cast shadows on enemy territory
    this.tryStrategicObstacle(scan, offsetX, offsetY);

    // State transitions — prioritize EXPAND and ATTACK, rarely DEFEND
    switch (this.state) {
      case 'EXPAND':
        // Attack enemy territory if we're big enough and enemies are nearby
        if (myPercent > 15 && scan.enemyCells.length > 3 && this.stateTimer > 4000) {
          this.state = 'ATTACK';
          this.stateTimer = 0;
        }
        // If an enemy is literally ON our territory (not just nearby), defend briefly
        else if (this.stateTimer > 6000 && this.isEnemyOnMyTerritory(scan)) {
          this.state = 'DEFEND';
          this.stateTimer = 0;
        }
        break;

      case 'ATTACK':
        if (scan.enemyCells.length === 0 || this.stateTimer > 6000) {
          this.state = 'EXPAND';
          this.stateTimer = 0;
        }
        // Switch to defend only if enemy is eating our cells right now
        if (this.stateTimer > 3000 && this.isEnemyOnMyTerritory(scan)) {
          this.state = 'DEFEND';
          this.stateTimer = 0;
        }
        break;

      case 'DEFEND':
        // Never defend for long — go back to expanding or attacking
        if (this.stateTimer > 2500 || !this.isEnemyOnMyTerritory(scan)) {
          this.state = scan.enemyCells.length > 2 ? 'ATTACK' : 'EXPAND';
          this.stateTimer = 0;
        }
        break;

      case 'CLEANSE':
        if (this.stateTimer > 3000) {
          this.state = 'EXPAND';
          this.stateTimer = 0;
        }
        break;

      case 'RETREAT':
        if (this.stateTimer > 2000) {
          this.state = 'EXPAND';
          this.stateTimer = 0;
        }
        break;
    }

    // Execute current state
    switch (this.state) {
      case 'EXPAND':
        this.pickExpandTarget(scan, offsetX, offsetY);
        break;
      case 'ATTACK':
        this.pickAttackTarget(scan, offsetX, offsetY);
        break;
      case 'DEFEND':
        this.pickDefendTarget(scan, offsetX, offsetY);
        break;
      case 'CLEANSE':
        this.pickCleanseTarget(scan, offsetX, offsetY);
        break;
      case 'RETREAT':
        this.pickRetreatTarget(scan, offsetX, offsetY);
        break;
    }
  }

  /**
   * Local scan — only examines cells within SCAN_RADIUS of bot position.
   * Returns categorized results without full grid traversal.
   */
  private scanArea(offsetX: number, offsetY: number): ScanResult {
    const result: ScanResult = {
      unclaimed: [],
      enemyCells: [],
      myEdge: [],
      nearbyEnemies: [],
      myCellCount: 0,
      totalScanCells: 0,
    };

    const pos = this.bot.getGridPosition(offsetX, offsetY);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);
    const r = this.SCAN_RADIUS;
    const obstacleSet = this.obstacles.getObstacleCells();

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = gcx + dx;
        const cy = gcy + dy;
        const cell = this.grid.getCell(cx, cy);
        if (!cell) continue;
        result.totalScanCells++;

        const cellDist = Math.sqrt(dx * dx + dy * dy);

        if (cell.ownerId === this.bot.id && cell.state !== CELL_STATE.NEUTRAL) {
          result.myCellCount++;
          // Check if edge cell
          let isEdge = false;
          for (const [ndx, ndy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const neighbor = this.grid.getCell(cx + ndx, cy + ndy);
            if (!neighbor || neighbor.ownerId !== this.bot.id || neighbor.state === CELL_STATE.NEUTRAL) {
              isEdge = true;
              break;
            }
          }
          if (isEdge && cellDist > 2) {
            result.myEdge.push({ cx, cy, dist: cellDist });
          }
        } else if (cell.state === CELL_STATE.NEUTRAL && !obstacleSet.has(`${cx},${cy}`)) {
          result.unclaimed.push({ cx, cy, dist: cellDist });
        } else if (cell.ownerId && cell.ownerId !== this.bot.id && cell.state !== CELL_STATE.NEUTRAL) {
          result.enemyCells.push({ cx, cy, dist: cellDist, ownerId: cell.ownerId! });
        }
      }
    }

    // Scan nearby enemy light positions
    for (const light of this.allLights) {
      if (light.id === this.bot.id) continue;
      const dist = Math.sqrt((light.wx - this.bot.wx) ** 2 + (light.wy - this.bot.wy) ** 2) / CELL_SIZE;
      if (dist < this.SCAN_RADIUS * 1.5) {
        result.nearbyEnemies.push({ id: light.id, wx: light.wx, wy: light.wy, dist });
      }
    }

    return result;
  }

  private pickExpandTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    if (scan.unclaimed.length === 0) {
      // Nothing nearby — move toward map center or random
      this.pickFallbackTarget(offsetX, offsetY);
      return;
    }

    // Pick closest unclaimed cell, slight preference for unclaimed near enemy territory
    const best = scan.unclaimed
      .sort((a, b) => {
        // Prefer cells closer to us
        if (Math.abs(a.dist - b.dist) > 1) return a.dist - b.dist;
        return a.dist - b.dist;
      })[0];

    // Add small random offset so bots don't stack
    this.targetX = offsetX + (best.cx + 0.5 + (Math.random() - 0.5) * 2) * CELL_SIZE;
    this.targetY = offsetY + (best.cy + 0.5 + (Math.random() - 0.5) * 2) * CELL_SIZE;
  }

  private pickAttackTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    if (scan.enemyCells.length === 0) {
      this.pickExpandTarget(scan, offsetX, offsetY);
      return;
    }

    // Pick nearest enemy territory cell to start claiming it
    // But spread across different enemies — don't tunnel-vision on one target
    const best = scan.enemyCells
      .sort((a, b) => {
        const distDiff = a.dist - b.dist;
        // If similar distance, prefer cells not adjacent to our territory
        // (those are already being naturally claimed at the border)
        if (Math.abs(distDiff) < 2) return a.dist - b.dist;
        return distDiff;
      })[0];

    this.targetX = offsetX + (best.cx + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (best.cy + 0.5) * CELL_SIZE;
  }

  private pickDefendTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    // If there's a threat, move to intercept — go between the threat and our territory edge
    if (scan.nearbyEnemies.length > 0 && scan.myEdge.length > 0) {
      const threat = scan.nearbyEnemies[0];
      const myEdge = scan.myEdge.sort((a, b) => a.dist - b.dist)[0];

      // Move toward the threat but don't chase past our border
      const threatCX = (threat.wx - offsetX) / CELL_SIZE;
      const threatCY = (threat.wy - offsetY) / CELL_SIZE;

      // Target point: between our edge and the threat
      const midX = (myEdge.cx + threatCX) / 2;
      const midY = (myEdge.cy + threatCY) / 2;

      this.targetX = offsetX + (midX + 0.5) * CELL_SIZE;
      this.targetY = offsetY + (midY + 0.5) * CELL_SIZE;
    } else if (scan.myEdge.length > 0) {
      // Patrol edge
      const edge = scan.myEdge[Math.floor(Math.random() * scan.myEdge.length)];
      this.targetX = offsetX + (edge.cx + 0.5) * CELL_SIZE;
      this.targetY = offsetY + (edge.cy + 0.5) * CELL_SIZE;
    } else {
      this.pickExpandTarget(scan, offsetX, offsetY);
    }
  }

  private pickCleanseTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    // Find obstacles near our territory that we can dissolve
    const pos = this.bot.getGridPosition(offsetX, offsetY);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);
    const obstacleSet = this.obstacles.getObstacleCells();
    const r = this.SCAN_RADIUS;

    let closestObs: { cx: number; cy: number; dist: number } | null = null;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = gcx + dx;
        const cy = gcy + dy;
        if (!obstacleSet.has(`${cx},${cy}`)) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        // Only target obstacles that cast shadows on our territory
        if (dist < (closestObs?.dist ?? Infinity)) {
          closestObs = { cx, cy, dist };
        }
      }
    }

    if (closestObs) {
      this.targetX = offsetX + (closestObs.cx + 0.5) * CELL_SIZE;
      this.targetY = offsetY + (closestObs.cy + 0.5) * CELL_SIZE;
    } else {
      this.pickExpandTarget(scan, offsetX, offsetY);
    }
  }

  private pickRetreatTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    // Move away from nearest enemy
    if (scan.nearbyEnemies.length > 0) {
      const threat = scan.nearbyEnemies[0];
      const pos = this.bot.getGridPosition(offsetX, offsetY);
      const dx = pos.cx - (threat.wx - offsetX) / CELL_SIZE;
      const dy = pos.cy - (threat.wy - offsetY) / CELL_SIZE;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.targetX = this.bot.wx + (dx / len) * CELL_SIZE * 5;
      this.targetY = this.bot.wy + (dy / len) * CELL_SIZE * 5;
    } else {
      this.pickExpandTarget(scan, offsetX, offsetY);
    }
  }

  private pickFallbackTarget(offsetX: number, offsetY: number): void {
    // Move toward map center with some randomness
    const cx = Math.floor(this.grid.width / 2) + Math.floor(Math.random() * 6) - 3;
    const cy = Math.floor(this.grid.height / 2) + Math.floor(Math.random() * 6) - 3;
    this.targetX = offsetX + (cx + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (cy + 0.5) * CELL_SIZE;
  }

  /**
   * Check if any enemy light is currently standing on or very near our territory.
   * Returns true only when there's actual territory loss happening, not just proximity.
   */
  private isEnemyOnMyTerritory(scan: ScanResult): boolean {
    if (scan.myCellCount < 5) return false;
    const gcx = Math.round(this.bot.getGridPosition(0, 0).cx);
    const gcy = Math.round(this.bot.getGridPosition(0, 0).cy);

    for (const enemy of scan.nearbyEnemies) {
      // Enemy must be within 2 cells of our territory edge
      if (enemy.dist > 3) continue;
      // Check if there are our cells near the enemy position
      const ecx = Math.round((enemy.wx) / CELL_SIZE);
      const ecy = Math.round((enemy.wy) / CELL_SIZE);
      for (const [ndx, ndy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const cell = this.grid.getCell(ecx + ndx, ecy + ndy);
        if (cell && cell.ownerId === this.bot.id && cell.state !== CELL_STATE.NEUTRAL) {
          return true;
        }
      }
    }
    return false;
  }
  private tryStrategicObstacle(scan: ScanResult, offsetX: number, offsetY: number): void {
    const budgetLeft = this.bot.obstacleBudget - this.obstacles.getObstacleCount(this.bot.id);
    if (budgetLeft <= 0) return;
    if (Date.now() - this.bot.lastPlacementTime < 1200) return;

    // Only place strategically 40% of decision cycles
    if (Math.random() > 0.4) return;

    const pos = this.bot.getGridPosition(offsetX, offsetY);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);
    const obstacleSet = this.obstacles.getObstacleCells();

    let bestCell: { cx: number; cy: number; score: number } | null = null;

    // Check cells within placement range (near bot)
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const cx = gcx + dx;
        const cy = gcy + dy;
        const key = `${cx},${cy}`;

        if (obstacleSet.has(key)) continue;
        if (!this.obstacles.canPlace(cx, cy, this.bot.id, this.grid)) continue;

        // Score: how many enemy cells are adjacent AND would be in shadow
        let score = 0;
        for (const [ndx, ndy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const adjCell = this.grid.getCell(cx + ndx, cy + ndy);
          if (adjCell && adjCell.ownerId && adjCell.ownerId !== this.bot.id) {
            score += 2;
          }
        }

        // Bonus if this cell is near the bot (can place quickly)
        const cellDist = Math.sqrt(dx * dx + dy * dy);
        if (cellDist <= 2) score += 1;

        if (score > 0 && (!bestCell || score > bestCell.score)) {
          bestCell = { cx, cy, score };
        }
      }
    }

    if (bestCell) {
      this.obstacles.place(bestCell.cx, bestCell.cy, this.bot.id);
      this.bot.lastPlacementTime = Date.now();
    }
  }

  private moveTowardsTarget(): void {
    const dx = this.targetX - this.bot.wx;
    const dy = this.targetY - this.bot.wy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.bot.setMoveInput(0, 0);
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    this.bot.setMoveInput(nx, ny);
  }
}
