import { PlayerLight } from '../entities/PlayerLight';
import { GridSystem } from '../systems/GridSystem';
import { ObstacleSystem } from '../systems/ObstacleSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { CELL_STATE, CELL_SIZE } from '../config';

type BotState = 'EXPAND' | 'ATTACK' | 'DEFEND' | 'CLEANSE' | 'RETREAT' | 'SEEK_POWERUP';

interface ScanResult {
  unclaimed: { cx: number; cy: number; dist: number }[];
  enemyCells: { cx: number; cy: number; dist: number; ownerId: string }[];
  myEdge: { cx: number; cy: number; dist: number }[];
  nearbyEnemies: { id: string; wx: number; wy: number; dist: number }[];
  nearbyPowerUps: { wx: number; wy: number; dist: number }[];
  nearbyMirrors: { cx: number; cy: number; dir: number; dist: number }[];
  myCellCount: number;
  totalScanCells: number;
}

export class BotAI {
  private bot: PlayerLight;
  private grid: GridSystem;
  private obstacles: ObstacleSystem;
  private powerUpSystem: PowerUpSystem | null;
  private reactionDelay: number;
  private lastDecisionTime: number = -Infinity;
  private state: BotState = 'EXPAND';
  private targetX: number = 0;
  private targetY: number = 0;
  private stateTimer: number = 0;
  private allLights: PlayerLight[];
  private difficulty: string;

  // Scan radius in cells — only look this far for decisions
  private readonly SCAN_RADIUS = 12;

  constructor(
    bot: PlayerLight,
    grid: GridSystem,
    obstacles: ObstacleSystem,
    reactionDelay: number,
    allLights: PlayerLight[],
    difficulty: string = 'medium',
    powerUpSystem: PowerUpSystem | null = null,
  ) {
    this.bot = bot;
    this.grid = grid;
    this.obstacles = obstacles;
    this.powerUpSystem = powerUpSystem;
    this.reactionDelay = reactionDelay;
    this.allLights = allLights;
    this.difficulty = difficulty;
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
    const isHard = this.difficulty === 'hard' || this.difficulty === 'nightmare';

    // Strategic obstacle placement — cast shadows on enemy territory
    this.tryStrategicObstacle(scan, offsetX, offsetY);

    // State transitions
    switch (this.state) {
      case 'EXPAND':
        if (myPercent > 15 && scan.enemyCells.length > 3 && this.stateTimer > 4000) {
          this.state = 'ATTACK';
          this.stateTimer = 0;
        }
        else if (this.stateTimer > 6000 && this.isEnemyOnMyTerritory(scan)) {
          this.state = 'DEFEND';
          this.stateTimer = 0;
        }
        // Hard+: seek power-ups if nearby
        else if (isHard && scan.nearbyPowerUps.length > 0 && this.stateTimer > 2000) {
          this.state = 'SEEK_POWERUP';
          this.stateTimer = 0;
        }
        break;

      case 'ATTACK':
        if (scan.enemyCells.length === 0 || this.stateTimer > 6000) {
          this.state = 'EXPAND';
          this.stateTimer = 0;
        }
        if (this.stateTimer > 3000 && this.isEnemyOnMyTerritory(scan)) {
          this.state = 'DEFEND';
          this.stateTimer = 0;
        }
        // Hard+: interrupt attack to grab nearby power-up
        else if (isHard && scan.nearbyPowerUps.length > 0 && scan.nearbyPowerUps[0].dist < 4) {
          this.state = 'SEEK_POWERUP';
          this.stateTimer = 0;
        }
        break;

      case 'DEFEND':
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

      case 'SEEK_POWERUP':
        if (this.stateTimer > 3000 || scan.nearbyPowerUps.length === 0) {
          this.state = scan.enemyCells.length > 2 ? 'ATTACK' : 'EXPAND';
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
      case 'SEEK_POWERUP':
        this.pickPowerUpTarget(scan);
        break;
    }
  }

  /**
   * Local scan — only examines cells within SCAN_RADIUS of bot position.
   */
  private scanArea(offsetX: number, offsetY: number): ScanResult {
    const result: ScanResult = {
      unclaimed: [],
      enemyCells: [],
      myEdge: [],
      nearbyEnemies: [],
      nearbyPowerUps: [],
      nearbyMirrors: [],
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

    // Scan nearby power-ups (hard+ only)
    if (isHard(this.difficulty)) {
      if (this.powerUpSystem) {
        for (const spawn of this.powerUpSystem.getSpawnPositions()) {
          const dist = Math.sqrt((spawn.wx - this.bot.wx) ** 2 + (spawn.wy - this.bot.wy) ** 2) / CELL_SIZE;
          if (dist < this.SCAN_RADIUS) {
            result.nearbyPowerUps.push({ wx: spawn.wx, wy: spawn.wy, dist });
          }
        }
      }
    }

    // Scan nearby mirrors (for avoidance on hard+)
    if (isHard(this.difficulty)) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const cx = gcx + dx;
          const cy = gcy + dy;
          const obs = this.obstacles.getObstacleAt(cx, cy);
          if (obs && obs.type === 'mirror') {
            const dist = Math.sqrt(dx * dx + dy * dy);
            result.nearbyMirrors.push({ cx, cy, dir: obs.mirrorDir, dist });
          }
        }
      }
    }

    return result;
  }

  private pickExpandTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    if (scan.unclaimed.length === 0) {
      this.pickFallbackTarget(offsetX, offsetY);
      return;
    }

    let best = scan.unclaimed[0];
    let bestScore = -Infinity;

    for (const cell of scan.unclaimed) {
      let score = -cell.dist; // prefer closer cells

      // Hard+: bonus for cells away from mirrors
      if (isHard(this.difficulty)) {
        for (const mirror of scan.nearbyMirrors) {
          const mirrorDist = Math.sqrt((cell.cx - mirror.cx) ** 2 + (cell.cy - mirror.cy) ** 2);
          if (mirrorDist < 3) score -= 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }

    this.targetX = offsetX + (best.cx + 0.5 + (Math.random() - 0.5) * 2) * CELL_SIZE;
    this.targetY = offsetY + (best.cy + 0.5 + (Math.random() - 0.5) * 2) * CELL_SIZE;
  }

  private pickAttackTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    if (scan.enemyCells.length === 0) {
      this.pickExpandTarget(scan, offsetX, offsetY);
      return;
    }

    // Find the weakest enemy by cell count in scan range
    const enemyCounts = new Map<string, number>();
    for (const cell of scan.enemyCells) {
      enemyCounts.set(cell.ownerId, (enemyCounts.get(cell.ownerId) || 0) + 1);
    }

    let weakestId = scan.enemyCells[0].ownerId;
    let weakestCount = Infinity;
    for (const [id, count] of enemyCounts) {
      if (count < weakestCount) {
        weakestCount = count;
        weakestId = id;
      }
    }

    const targets = scan.enemyCells.filter(c => c.ownerId === weakestId);
    const best = targets.sort((a, b) => a.dist - b.dist)[0];

    this.targetX = offsetX + (best.cx + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (best.cy + 0.5) * CELL_SIZE;
  }

  private pickPowerUpTarget(scan: ScanResult): void {
    if (scan.nearbyPowerUps.length === 0) {
      this.pickExpandTarget(scan, 0, 0);
      return;
    }

    const nearest = scan.nearbyPowerUps.sort((a, b) => a.dist - b.dist)[0];
    this.targetX = nearest.wx;
    this.targetY = nearest.wy;
  }

  private pickDefendTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
    if (scan.nearbyEnemies.length > 0 && scan.myEdge.length > 0) {
      const threat = scan.nearbyEnemies[0];
      const myEdge = scan.myEdge.sort((a, b) => a.dist - b.dist)[0];

      const threatCX = (threat.wx - offsetX) / CELL_SIZE;
      const threatCY = (threat.wy - offsetY) / CELL_SIZE;

      const midX = (myEdge.cx + threatCX) / 2;
      const midY = (myEdge.cy + threatCY) / 2;

      this.targetX = offsetX + (midX + 0.5) * CELL_SIZE;
      this.targetY = offsetY + (midY + 0.5) * CELL_SIZE;
    } else if (scan.myEdge.length > 0) {
      const edge = scan.myEdge[Math.floor(Math.random() * scan.myEdge.length)];
      this.targetX = offsetX + (edge.cx + 0.5) * CELL_SIZE;
      this.targetY = offsetY + (edge.cy + 0.5) * CELL_SIZE;
    } else {
      this.pickExpandTarget(scan, offsetX, offsetY);
    }
  }

  private pickCleanseTarget(scan: ScanResult, offsetX: number, offsetY: number): void {
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
    const cx = Math.floor(this.grid.width / 2) + Math.floor(Math.random() * 6) - 3;
    const cy = Math.floor(this.grid.height / 2) + Math.floor(Math.random() * 6) - 3;
    this.targetX = offsetX + (cx + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (cy + 0.5) * CELL_SIZE;
  }

  private isEnemyOnMyTerritory(scan: ScanResult): boolean {
    if (scan.myCellCount < 5) return false;

    for (const enemy of scan.nearbyEnemies) {
      if (enemy.dist > 3) continue;
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

    const placeChance = this.difficulty === 'nightmare' ? 0.6 : 0.4;
    if (Math.random() > placeChance) return;

    const pos = this.bot.getGridPosition(offsetX, offsetY);
    const gcx = Math.round(pos.cx);
    const gcy = Math.round(pos.cy);
    const obstacleSet = this.obstacles.getObstacleCells();

    let bestCell: { cx: number; cy: number; score: number } | null = null;

    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const cx = gcx + dx;
        const cy = gcy + dy;
        const key = `${cx},${cy}`;

        if (obstacleSet.has(key)) continue;
        if (!this.obstacles.canPlace(cx, cy, this.bot.id, this.grid)) continue;

        let score = 0;
        for (const [ndx, ndy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const adjCell = this.grid.getCell(cx + ndx, cy + ndy);
          if (adjCell && adjCell.ownerId && adjCell.ownerId !== this.bot.id) {
            score += 2;
          }
        }

        const cellDist = Math.sqrt(dx * dx + dy * dy);
        if (cellDist <= 2) score += 1;

        // Nightmare: extra points for shadowing enemy clusters
        if (this.difficulty === 'nightmare') {
          let enemyShadow = 0;
          for (let sdy = -2; sdy <= 2; sdy++) {
            for (let sdx = -2; sdx <= 2; sdx++) {
              const sc = this.grid.getCell(cx + sdx, cy + sdy);
              if (sc && sc.ownerId && sc.ownerId !== this.bot.id) {
                enemyShadow++;
              }
            }
          }
          score += enemyShadow;
        }

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

function isHard(difficulty: string): boolean {
  return difficulty === 'hard' || difficulty === 'nightmare';
}
