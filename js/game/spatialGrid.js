export class SpatialGrid {
  constructor(cellSize = 80) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.maxRadius = 0;
  }

  clear() {
    this.cells.clear();
    this.maxRadius = 0;
  }

  add(actor) {
    const key = this.key(Math.floor(actor.x / this.cellSize), Math.floor(actor.y / this.cellSize));
    const cell = this.cells.get(key);
    if (cell) cell.push(actor);
    else this.cells.set(key, [actor]);
    this.maxRadius = Math.max(this.maxRadius, actor.r);
  }

  key(x, y) {
    return `${x},${y}`;
  }

  *near(x, y, radius) {
    const reach = radius + this.maxRadius;
    const endX = Math.floor((x + reach) / this.cellSize);
    const endY = Math.floor((y + reach) / this.cellSize);
    for (let col = Math.floor((x - reach) / this.cellSize); col <= endX; col++) {
      for (let row = Math.floor((y - reach) / this.cellSize); row <= endY; row++) {
        const cell = this.cells.get(this.key(col, row));
        if (cell) yield* cell;
      }
    }
  }
}
