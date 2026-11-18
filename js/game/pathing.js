export class Path {
  constructor(points) {
    this.points = points;
    this.segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!len) continue;
      this.segs.push({ a, b, len, start: total, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len });
      total += len;
    }
    this.length = total;
  }

  pointAt(d) {
    const segs = this.segs;
    if (d <= 0) return { x: segs[0].a.x, y: segs[0].a.y };
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].start <= d) lo = mid; else hi = mid - 1;
    }
    const s = segs[lo];
    const t = Math.min(d - s.start, s.len);
    return { x: s.a.x + s.dx * t, y: s.a.y + s.dy * t };
  }

  nearestPoint(x, y) {
    let best = Infinity;
    let along = 0;
    for (const s of this.segs) {
      const t = Math.max(0, Math.min(s.len, (x - s.a.x) * s.dx + (y - s.a.y) * s.dy));
      const distance = Math.hypot(x - (s.a.x + s.dx * t), y - (s.a.y + s.dy * t));
      if (distance < best) { best = distance; along = s.start + t; }
    }
    return { distance: best, along };
  }

  distanceTo(x, y) { return this.nearestPoint(x, y).distance; }
  distanceAlong(x, y) { return this.nearestPoint(x, y).along; }
}
