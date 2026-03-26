import { PlayerLight } from '../entities/PlayerLight';
import { GridSystem, type CellData } from '../systems/GridSystem';
import { ObstacleSystem } from '../systems/ObstacleSystem';
import { CELL_STATE, CELL_SIZE } from '../config';

type BotState = 'EXPAND' | 'ATTACK' | 'DEFEND' | 'CLEANSE' | 'WANDER';

export class BotAI {
  private bot: PlayerLight;
  private grid: GridSystem;
  private obstacles: ObstacleSystem;
  private reactionDelay: number;
  private lastDecisionTime: number = 0;
  private state: BotState = 'EXPAND';
  private targetX: number = 0;
  private targetY: number = 0;
  private stateTimer: number = 0;
  private allLightPositions: PlayerLight[];

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
    this.allLightPositions = allLights;

    this.targetX = bot.wx;
    this.targetY = bot.wy;
  }

  update(time: number, delta: number, offsetX: number, offsetY: number): void {
    if (time - this.lastDecisionTime < this.reactionDelay) {
      // Continue moving towards current target
      this.moveTowardsTarget(delta);
      return;
    }

    this.lastDecisionTime = time;
    this.stateTimer += delta;

    // Assess situation
    const myCells = this.countOwnedCells(this.bot.id);
    const totalCells = this.grid.getTotalCells();
    const myPercent = (myCells / totalCells) * 100;

    // Decide state
    this.decideState(myCells, myPercent);

    // Execute state
    switch (this.state) {
      case 'EXPAND':
        this.findUnclaimedCell(offsetX, offsetY);
        break;
      case 'ATTACK':
        this.findPlayerTerritory(offsetX, offsetY);
        break;
      case 'DEFEND':
        this.findMyTerritoryEdge(offsetX, offsetY);
        break;
      case 'CLEANSE':
        this.findNearestObstacle(offsetX, offsetY);
        break;
      case 'WANDER':
        this.findRandomCell(offsetX, offsetY);
        break;
    }

    this.moveTowardsTarget(delta);

    // Place obstacles occasionally
    if (Math.random() < 0.3) {
      this.tryPlaceObstacle(offsetX, offsetY);
    }
  }

  private decideState(myCells: number, myPercent: number): void {
    if (myCells < 5) {
      this.state = 'EXPAND';
    } else if (myPercent > 40 && this.hasNearbyObstacles()) {
      this.state = 'CLEANSE';
    } else if (this.stateTimer > 5000 && this.hasPlayerNearby()) {
      this.state = 'ATTACK';
      this.stateTimer = 0;
    } else if (this.stateTimer > 8000) {
      this.state = Math.random() < 0.5 ? 'EXPAND' : 'DEFEND';
      this.stateTimer = 0;
    }
  }

  private findUnclaimedCell(offsetX: number, offsetY: number): void {
    const pos = this.bot.getGridPosition(offsetX, offsetY);
    let bestDist = Infinity;
    let bestCX = Math.floor(this.grid.width / 2);
    let bestCY = Math.floor(this.grid.height / 2);

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.ownerId === this.bot.id) continue;
        if (this.grid.isBlocked(x, y, this.obstacles.getObstacleCells())) continue;

        const dist = Math.sqrt((x - pos.cx) ** 2 + (y - pos.cy) ** 2);
        // Prefer neutral cells slightly closer
        const weight = cell.state === CELL_STATE.NEUTRAL ? dist : dist * 1.5;
        if (weight < bestDist) {
          bestDist = weight;
          bestCX = x;
          bestCY = y;
        }
      }
    }

    this.targetX = offsetX + (bestCX + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (bestCY + 0.5) * CELL_SIZE;
  }

  private findPlayerTerritory(offsetX: number, offsetY: number): void {
    const pos = this.bot.getGridPosition(offsetX, offsetY);
    let bestDist = Infinity;
    let bestCX = Math.floor(this.grid.width / 2);
    let bestCY = Math.floor(this.grid.height / 2);

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.ownerId === this.bot.id || cell.state === CELL_STATE.NEUTRAL) continue;

        const dist = Math.sqrt((x - pos.cx) ** 2 + (y - pos.cy) ** 2);
        if (dist < bestDist && dist < this.bot.lightRadius * 3) {
          bestDist = dist;
          bestCX = x;
          bestCY = y;
        }
      }
    }

    this.targetX = offsetX + (bestCX + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (bestCY + 0.5) * CELL_SIZE;
  }

  private findMyTerritoryEdge(offsetX: number, offsetY: number): void {
    const pos = this.bot.getGridPosition(offsetX, offsetY);
    let bestDist = Infinity;
    let bestCX = Math.floor(this.grid.width / 2);
    let bestCY = Math.floor(this.grid.height / 2);

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.ownerId !== this.bot.id) continue;

        // Check if this is an edge cell (adjacent to non-owned)
        let isEdge = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const neighbor = this.grid.getCell(x + dx, y + dy);
          if (!neighbor || neighbor.ownerId !== this.bot.id) {
            isEdge = true;
            break;
          }
        }

        if (isEdge) {
          const dist = Math.sqrt((x - pos.cx) ** 2 + (y - pos.cy) ** 2);
          if (dist > 2 && dist < bestDist) { // Don't go too close, spread out
            bestDist = dist;
            bestCX = x;
            bestCY = y;
          }
        }
      }
    }

    this.targetX = offsetX + (bestCX + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (bestCY + 0.5) * CELL_SIZE;
  }

  private findNearestObstacle(offsetX: number, offsetY: number): void {
    const pos = this.bot.getGridPosition(offsetX, offsetY);
    let bestDist = Infinity;
    let bestCX = pos.cx;
    let bestCY = pos.cy;

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (!this.grid.isBlocked(x, y, this.obstacles.getObstacleCells())) continue;
        const dist = Math.sqrt((x - pos.cx) ** 2 + (y - pos.cy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestCX = x;
          bestCY = y;
        }
      }
    }

    // Move close to obstacle (within dissolve distance)
    this.targetX = offsetX + (bestCX + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (bestCY + 0.5) * CELL_SIZE;
  }

  private findRandomCell(offsetX: number, offsetY: number): void {
    const cx = Math.floor(Math.random() * this.grid.width);
    const cy = Math.floor(Math.random() * this.grid.height);
    this.targetX = offsetX + (cx + 0.5) * CELL_SIZE;
    this.targetY = offsetY + (cy + 0.5) * CELL_SIZE;
  }

  private moveTowardsTarget(delta: number): void {
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

  private tryPlaceObstacle(offsetX: number, offsetY: number): void {
    if (this.obstacles.getObstacleCount(this.bot.id) >= this.bot.obstacleBudget) return;
    if (Date.now() - this.bot.lastPlacementTime < 1000) return;

    const pos = this.bot.getGridPosition(offsetX, offsetY);

    // Try to place near player territory
    for (let attempt = 0; attempt < 5; attempt++) {
      const cx = pos.cx + Math.floor(Math.random() * 7) - 3;
      const cy = pos.cy + Math.floor(Math.random() * 7) - 3;

      if (this.obstacles.canPlace(Math.round(cx), Math.round(cy), this.bot.id, this.grid)) {
        this.obstacles.place(Math.round(cx), Math.round(cy), this.bot.id);
        this.bot.lastPlacementTime = Date.now();
        break;
      }
    }
  }

  private countOwnedCells(ownerId: string): number {
    let count = 0;
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (cell && cell.ownerId === ownerId && cell.state !== CELL_STATE.NEUTRAL) {
          count++;
        }
      }
    }
    return count;
  }

  private hasNearbyObstacles(): boolean {
    const pos = this.bot.getGridPosition(0, 0);
    // Simple check - we need offsetX/offsetY but we'll use approximate
    const checkRange = Math.ceil(this.bot.lightRadius * 2);
    for (let dy = -checkRange; dy <= checkRange; dy++) {
      for (let dx = -checkRange; dx <= checkRange; dx++) {
        if (this.grid.isBlocked(Math.round(pos.cx) + dx, Math.round(pos.cy) + dy, this.obstacles.getObstacleCells())) {
          return true;
        }
      }
    }
    return false;
  }

  private hasPlayerNearby(): boolean {
    for (const light of this.allLightPositions) {
      if (light.id === this.bot.id) continue;
      const dist = Math.sqrt((light.wx - this.bot.wx) ** 2 + (light.wy - this.bot.wy) ** 2);
      if (dist < this.bot.lightRadius * CELL_SIZE * 3) return true;
    }
    return false;
  }
}
