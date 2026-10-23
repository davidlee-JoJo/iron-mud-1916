import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// 以射線掃描建立可行走網格，再用 A* 產生路徑。
class MinHeap {
  constructor() {
    this.items = [];
  }

  push(node) {
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].f <= this.items[i].f) break;
      const t = this.items[p];
      this.items[p] = this.items[i];
      this.items[i] = t;
      i = p;
    }
  }

  pop() {
    if (!this.items.length) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let best = i;
        if (l < this.items.length && this.items[l].f < this.items[best].f) best = l;
        if (r < this.items.length && this.items[r].f < this.items[best].f) best = r;
        if (best === i) break;
        const t = this.items[best];
        this.items[best] = this.items[i];
        this.items[i] = t;
        i = best;
      }
    }
    return top;
  }
}

export class NavGrid {
  constructor(map) {
    this.map = map;
    this.world = map.game.physicsWorld;
    this.size = map.meta.size;
    this.cell = 1.5;
    this.cols = Math.ceil(this.size / this.cell);
    this.rows = this.cols;
    this.half = this.size / 2;
    this.walkable = new Uint8Array(this.cols * this.rows);
    this.heights = new Float32Array(this.cols * this.rows);
    this.gScore = new Float32Array(this.cols * this.rows);
    this.cameFrom = new Int32Array(this.cols * this.rows);
    this.closed = new Uint8Array(this.cols * this.rows);
    this.ready = false;
  }

  cellIndex(ix, iz) {
    return iz * this.cols + ix;
  }

  worldToCell(x, z) {
    return {
      ix: Math.floor((x + this.half) / this.cell),
      iz: Math.floor((z + this.half) / this.cell)
    };
  }

  cellCenter(ix, iz) {
    return {
      x: -this.half + (ix + 0.5) * this.cell,
      z: -this.half + (iz + 0.5) * this.cell,
      y: this.heights[this.cellIndex(ix, iz)]
    };
  }

  inBounds(ix, iz) {
    return ix >= 0 && iz >= 0 && ix < this.cols && iz < this.rows;
  }

  async build(onProgress) {
    const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const upRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    let count = 0;
    for (let iz = 0; iz < this.rows; iz++) {
      for (let ix = 0; ix < this.cols; ix++) {
        const x = -this.half + (ix + 0.5) * this.cell;
        const z = -this.half + (iz + 0.5) * this.cell;
        const idx = this.cellIndex(ix, iz);
        this.walkable[idx] = 0;
        this.heights[idx] = this.map.heightAt(x, z);

        if (this.map.terrain.isDeepWater(x, z)) continue;

        ray.origin.x = x;
        ray.origin.y = 120;
        ray.origin.z = z;
        const hit = this.world.castRayAndGetNormal(ray, 220, true);
        if (!hit) continue;
        const y = 120 - hit.timeOfImpact;
        if (hit.normal.y < 0.52) continue;
        if (y > 45) continue;

        upRay.origin.x = x;
        upRay.origin.y = y + 0.25;
        upRay.origin.z = z;
        const overhead = this.world.castRay(upRay, 2.1, true);
        if (overhead) continue;

        this.walkable[idx] = 1;
        this.heights[idx] = y;
        count++;
        if (count % 2500 === 0) {
          if (onProgress) onProgress(count);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }
    this.ready = true;
    if (onProgress) onProgress(count, true);
    return count;
  }

  isWalkableAt(x, z) {
    const c = this.worldToCell(x, z);
    if (!this.inBounds(c.ix, c.iz)) return false;
    return this.walkable[this.cellIndex(c.ix, c.iz)] === 1;
  }

  heightAtCell(ix, iz) {
    return this.heights[this.cellIndex(ix, iz)];
  }

  nearestWalkable(x, z, maxRadius = 12) {
    const c = this.worldToCell(x, z);
    if (this.inBounds(c.ix, c.iz) && this.walkable[this.cellIndex(c.ix, c.iz)]) return c;
    for (let r = 1; r <= maxRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = c.ix + dx;
          const iz = c.iz + dz;
          if (!this.inBounds(ix, iz)) continue;
          if (this.walkable[this.cellIndex(ix, iz)]) return { ix, iz };
        }
      }
    }
    return null;
  }

  lineWalkable(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.6)));
    let prevY = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const c = this.worldToCell(x, z);
      if (!this.inBounds(c.ix, c.iz)) return false;
      const idx = this.cellIndex(c.ix, c.iz);
      if (!this.walkable[idx]) return false;
      const y = this.heights[idx];
      if (prevY !== null && Math.abs(y - prevY) > 0.75) return false;
      prevY = y;
    }
    return true;
  }

  findPath(start, end) {
    if (!this.ready) return [];
    let sc = this.nearestWalkable(start.x, start.z);
    let ec = this.nearestWalkable(end.x, end.z);
    if (!sc || !ec) return [];

    const startIdx = this.cellIndex(sc.ix, sc.iz);
    const endIdx = this.cellIndex(ec.ix, ec.iz);
    if (startIdx === endIdx) {
      const p = this.cellCenter(ec.ix, ec.iz);
      return [new THREE.Vector3(p.x, p.y + 0.05, p.z)];
    }

    this.gScore.fill(Infinity);
    this.closed.fill(0);
    this.cameFrom.fill(-1);
    this.gScore[startIdx] = 0;

    const heap = new MinHeap();
    const h = (ix, iz) => {
      const dx = Math.abs(ix - ec.ix);
      const dz = Math.abs(iz - ec.iz);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    heap.push({ idx: startIdx, ix: sc.ix, iz: sc.iz, f: h(sc.ix, sc.iz) });

    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];

    let iterations = 0;
    let found = false;
    while (heap.items.length && iterations < 12000) {
      iterations++;
      const cur = heap.pop();
      if (!cur) break;
      if (this.closed[cur.idx]) continue;
      if (cur.idx === endIdx) {
        found = true;
        break;
      }
      this.closed[cur.idx] = 1;
      const curY = this.heights[cur.idx];

      for (const [dx, dz, cost] of dirs) {
        const nx = cur.ix + dx;
        const nz = cur.iz + dz;
        if (!this.inBounds(nx, nz)) continue;
        const nIdx = this.cellIndex(nx, nz);
        if (!this.walkable[nIdx] || this.closed[nIdx]) continue;
        if (Math.abs(this.heights[nIdx] - curY) > 0.75) continue;
        if (dx !== 0 && dz !== 0) {
          const a = this.cellIndex(cur.ix + dx, cur.iz);
          const b = this.cellIndex(cur.ix, cur.iz + dz);
          if (!this.walkable[a] || !this.walkable[b]) continue;
          if (Math.abs(this.heights[a] - curY) > 0.75 || Math.abs(this.heights[b] - curY) > 0.75) continue;
        }
        const tentative = this.gScore[cur.idx] + cost;
        if (tentative < this.gScore[nIdx]) {
          this.gScore[nIdx] = tentative;
          this.cameFrom[nIdx] = cur.idx;
          heap.push({ idx: nIdx, ix: nx, iz: nz, f: tentative + h(nx, nz) });
        }
      }
    }

    if (!found) return [];

    const raw = [];
    let node = endIdx;
    let guard = 0;
    while (node !== -1 && guard < 5000) {
      guard++;
      const ix = node % this.cols;
      const iz = Math.floor(node / this.cols);
      const p = this.cellCenter(ix, iz);
      raw.push(new THREE.Vector3(p.x, p.y + 0.05, p.z));
      if (node === startIdx) break;
      node = this.cameFrom[node];
    }
    raw.reverse();

    // 路徑平滑：盡量跳過中間點，只保留可直線行走的轉折。
    const smooth = [];
    if (raw.length) {
      smooth.push(raw[0]);
      let i = 0;
      while (i < raw.length - 1) {
        let furthest = i + 1;
        for (let j = raw.length - 1; j > i; j--) {
          if (this.lineWalkable(raw[i].x, raw[i].z, raw[j].x, raw[j].z)) {
            furthest = j;
            break;
          }
        }
        smooth.push(raw[furthest]);
        i = furthest;
      }
    }
    return smooth;
  }

  randomNear(pos, radius, rng) {
    for (let i = 0; i < 24; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * radius;
      const x = pos.x + Math.cos(a) * r;
      const z = pos.z + Math.sin(a) * r;
      if (this.isWalkableAt(x, z)) {
        return new THREE.Vector3(x, this.heights[this.cellIndex(this.worldToCell(x, z).ix, this.worldToCell(x, z).iz)] + 0.1, z);
      }
    }
    return null;
  }
}
