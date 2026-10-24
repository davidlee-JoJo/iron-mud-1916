import * as THREE from 'three';
import { RNG } from '../core/Random.js';
import { clamp, distanceToPolyline } from '../core/MathUtils.js';
import {
  buildSandbagWall,
  buildBarbedWire,
  buildCrates,
  buildBarrels,
  buildArtillery,
  buildCart,
  buildWell,
  buildGravestones,
  buildRailway
} from './Props.js';

// 共用建築工具：帶門窗開口的牆、房屋、教堂、戰壕、堡壘、車站、磨坊等。

function addWallWithOpenings(map, ax, az, bx, bz, yBase, height, thickness, matKey, openings = []) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const angle = Math.atan2(dx, dz);
  const sorted = openings.slice().sort((a, b) => a.start - b.start);

  const addSeg = (start, end, y, h) => {
    if (end - start < 0.03 || h < 0.03) return;
    const t = (start + end) * 0.5;
    const x = ax + dx * (t / len);
    const z = az + dz * (t / len);
    map.batch.addBox(thickness, h, end - start, x, y + h * 0.5, z, angle, matKey, true);
  };

  let cursor = 0;
  for (const o of sorted) {
    addSeg(cursor, o.start, yBase, height);
    if (o.bottom > 0.05) addSeg(o.start, o.end, yBase, o.bottom);
    if (o.top < height - 0.05) addSeg(o.start, o.end, yBase + o.top, height - o.top);
    if (o.glass) {
      const t = (o.start + o.end) * 0.5;
      const x = ax + dx * (t / len);
      const z = az + dz * (t / len);
      map.batch.addBox(0.08, o.top - o.bottom, o.end - o.start, x, yBase + (o.bottom + o.top) * 0.5, z, angle, 'glass', false);
    }
    cursor = o.end;
  }
  addSeg(cursor, len, yBase, height);
}

function localToWorld(cx, cz, rotY, lx, lz) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return { x: cx + lx * c + lz * s, z: cz - lx * s + lz * c };
}

function addPoster(map, x, z, rotY, y) {
  const geo = new THREE.PlaneGeometry(1.4, 1.8);
  const mesh = new THREE.Mesh(geo, map.assets.materials.poster);
  mesh.position.set(x, y + 1.5, z);
  mesh.rotation.y = rotY;
  map.group.add(mesh);
}

function addLamp(map, x, z, terrain) {
  const y = terrain.heightAt(x, z);
  map.batch.addBox(0.12, 4.4, 0.12, x, y + 2.2, z, 0, 'metalDark', true);
  map.batch.addBox(0.5, 0.5, 0.5, x, y + 4.5, z, 0, 'emissiveLamp', false);
  const light = new THREE.PointLight(0xffb45e, 7, 20, 2);
  light.position.set(x, y + 4.4, z);
  map.group.add(light);
}

function addRubble(map, x, z, radius, count, terrain) {
  for (let i = 0; i < count; i++) {
    const a = map.rng.range(0, Math.PI * 2);
    const r = Math.sqrt(map.rng.next()) * radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    const y = terrain.heightAt(px, pz);
    const s = map.rng.range(0.2, 1.0);
    map.batch.addBox(s, s * 0.5, s * 0.8, px, y + s * 0.25, pz, map.rng.range(0, Math.PI), 'rubble', true);
  }
}

function addStaticCrates(map, x, z, y, count) {
  for (let i = 0; i < count; i++) {
    const s = map.rng.range(0.7, 1.1);
    map.batch.addBox(s, s, s, x + map.rng.range(-1.2, 1.2), y + s * 0.5, z + map.rng.range(-1.2, 1.2), map.rng.range(0, Math.PI), 'wood', true);
  }
}

function addFence(map, ax, az, bx, bz, terrain) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const count = Math.max(1, Math.floor(len / 2.4));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = ax + dx * t;
    const z = az + dz * t;
    const y = terrain.heightAt(x, z);
    map.batch.addBox(0.12, 1.3, 0.12, x, y + 0.65, z, angle, 'wood', true);
  }
  const y1 = terrain.heightAt(ax, az);
  const y2 = terrain.heightAt(bx, bz);
  map.batch.addBox(0.08, 0.12, len, (ax + bx) / 2, (y1 + y2) / 2 + 0.85, (az + bz) / 2, angle, 'wood', false);
  map.batch.addBox(0.08, 0.12, len, (ax + bx) / 2, (y1 + y2) / 2 + 0.45, (az + bz) / 2, angle, 'wood', false);
}

function addLaundry(map, ax, az, bx, bz, terrain) {
  const y1 = terrain.heightAt(ax, az) + 4;
  const y2 = terrain.heightAt(bx, bz) + 4;
  const points = [ax, y1, az, bx, y2, bz];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const line = new THREE.Line(geo, map.assets.materials.wire);
  map.group.add(line);
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const y = y1 + (y2 - y1) * t;
    map.batch.addBox(0.8, 1.2, 0.04, x, y - 0.65, z, Math.atan2(bx - ax, bz - az), 'poster', false);
  }
}

function addSandbagRing(map, x, z, radius, terrain) {
  const points = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    points.push([x + Math.cos(a) * radius, z + Math.sin(a) * radius]);
  }
  buildSandbagWall(map.batch, points, 0.9, terrain);
}

function addBuilding(map, cx, cz, w, d, h, rotY, opts = {}) {
  const terrain = map.terrain;
  const yBase = terrain.heightAt(cx, cz);
  const stone = opts.stone ? 'stone' : 'wood';
  const roof = opts.roof ?? map.rng.chance(0.45);

  map.batch.addBox(w, 0.3, d, cx, yBase + 0.15, cz, rotY, 'stone', true);

  const corners = {
    front: [localToWorld(cx, cz, rotY, -w / 2, d / 2), localToWorld(cx, cz, rotY, w / 2, d / 2)],
    back: [localToWorld(cx, cz, rotY, w / 2, -d / 2), localToWorld(cx, cz, rotY, -w / 2, -d / 2)],
    left: [localToWorld(cx, cz, rotY, -w / 2, -d / 2), localToWorld(cx, cz, rotY, -w / 2, d / 2)],
    right: [localToWorld(cx, cz, rotY, w / 2, d / 2), localToWorld(cx, cz, rotY, w / 2, -d / 2)]
  };

  const doorStart = w * 0.5 - 0.75;
  const doorEnd = w * 0.5 + 0.75;
  addWallWithOpenings(map, corners.front[0].x, corners.front[0].z, corners.front[1].x, corners.front[1].z, yBase, h, 0.4, stone, [
    { start: doorStart, end: doorEnd, bottom: 0, top: 2.2 }
  ]);
  addWallWithOpenings(map, corners.back[0].x, corners.back[0].z, corners.back[1].x, corners.back[1].z, yBase, h, 0.4, stone, [
    { start: w * 0.3, end: w * 0.3 + 1.4, bottom: 1.1, top: 2.3, glass: true }
  ]);
  addWallWithOpenings(map, corners.left[0].x, corners.left[0].z, corners.left[1].x, corners.left[1].z, yBase, h, 0.4, stone, [
    { start: d * 0.25, end: d * 0.25 + 1.3, bottom: 1.1, top: 2.3, glass: true }
  ]);
  addWallWithOpenings(map, corners.right[0].x, corners.right[0].z, corners.right[1].x, corners.right[1].z, yBase, h, 0.4, stone, [
    { start: d * 0.55, end: d * 0.55 + 1.3, bottom: 1.1, top: 2.3, glass: true }
  ]);

  if (roof) {
    map.batch.addBox(w + 0.7, 0.3, d + 0.7, cx, yBase + h + 0.15, cz, rotY, 'roof', true);
    map.batch.addBox(w + 0.9, 0.25, 0.4, cx, yBase + h - 0.2, cz - d / 2 - 0.2, rotY, 'roof', false);
    map.batch.addBox(w + 0.9, 0.25, 0.4, cx, yBase + h - 0.2, cz + d / 2 + 0.2, rotY, 'roof', false);
  } else {
    map.batch.addBox(w * 0.5, 0.25, d * 0.3, cx, yBase + h + 0.1, cz, rotY, 'rubble', false);
  }

  const p = localToWorld(cx, cz, rotY, 0, d / 2 + 0.22);
  if (map.rng.chance(0.4)) addPoster(map, p.x, p.z, rotY, yBase);

  if (map.rng.chance(0.65)) {
    addRubble(map, cx + map.rng.range(-w / 2, w / 2), cz + map.rng.range(-d / 2, d / 2), 2.5, 6, terrain);
  }
  if (!roof) addStaticCrates(map, cx, cz, yBase, map.rng.int(1, 3));
}

export function buildVillage(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const rng = map.rng;

  if (opts.church) {
    const [chx, chz] = opts.churchPos;
    const y = terrain.heightAt(chx, chz);
    map.batch.addBox(15, 0.4, 24, chx, y + 0.2, chz, 0, 'stone', true);
    addWallWithOpenings(map, chx - 7.5, chz + 12, chx + 7.5, chz + 12, y, 9, 0.6, 'stone', [
      { start: 5, end: 8, bottom: 0, top: 4.2 },
      { start: 2, end: 3.4, bottom: 3, top: 5.5, glass: true },
      { start: 11, end: 12.4, bottom: 3, top: 5.5, glass: true }
    ]);
    addWallWithOpenings(map, chx - 7.5, chz - 12, chx + 7.5, chz - 12, y, 9, 0.6, 'stone', [
      { start: 6.5, end: 8, bottom: 3, top: 5.5, glass: true }
    ]);
    addWallWithOpenings(map, chx - 7.5, chz - 12, chx - 7.5, chz + 12, y, 9, 0.6, 'stone', [
      { start: 5, end: 6.4, bottom: 2.5, top: 5.2, glass: true },
      { start: 15, end: 16.4, bottom: 2.5, top: 5.2, glass: true }
    ]);
    addWallWithOpenings(map, chx + 7.5, chz + 12, chx + 7.5, chz - 12, y, 9, 0.6, 'stone', [
      { start: 7, end: 8.4, bottom: 2.5, top: 5.2, glass: true }
    ]);
    map.batch.addBox(16, 0.4, 25, chx, y + 9.2, chz, 0, 'roof', true);
    map.batch.addBox(7, 18, 7, chx + 3, y + 9, chz - 10, 0, 'stone', true);
    map.batch.addBox(7.6, 0.6, 7.6, chx + 3, y + 18.2, chz - 10, 0, 'stone', true);
    for (const [ox, oz] of [[-3.5, 0], [3.5, 0], [0, -3.5], [0, 3.5]]) {
      map.batch.addBox(1.4, 1.2, 1.4, chx + 3 + ox, y + 18.6, chz - 10 + oz, 0, 'stone', false);
    }
    map.batch.addCylinder(0.7, 0.7, 0.8, chx + 3, y + 17.3, chz - 10, 0, 0, 0, 'metalDark', false, 10);
    map.batch.addBox(0.25, 1.2, 0.25, chx + 3, y + 19.6, chz - 10, 0, 'metalDark', false);
    map.batch.addBox(1.1, 0.22, 0.22, chx + 3, y + 19.9, chz - 10, 0, 'metalDark', false);
    buildGravestones(map.batch, rng, terrain, 18, [chx + 8, chz + 16], 14);
    addLamp(map, chx - 6, chz + 14, terrain);
    addRubble(map, chx - 6, chz - 4, 4, 10, terrain);
  }

  const placed = [];
  for (let i = 0; i < opts.buildings; i++) {
    let tries = 0;
    let x;
    let z;
    do {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(18, opts.radius - 12);
      x = cx + Math.cos(a) * r;
      z = cz + Math.sin(a) * r;
      tries++;
    } while (tries < 30 && (Math.hypot(x - cx, z - cz) < 16 || Math.hypot(x - (opts.churchPos?.[0] ?? 999), z - (opts.churchPos?.[1] ?? 999)) < 22 || placed.some((p) => Math.hypot(x - p[0], z - p[1]) < 13)));
    if (tries >= 30) continue;
    placed.push([x, z]);
    const w = rng.range(6, 11);
    const d = rng.range(6, 10);
    const h = rng.range(4, 7);
    addBuilding(map, x, z, w, d, h, rng.range(-0.35, 0.35), { stone: rng.chance(0.5), roof: rng.chance(0.45) });
  }

  const square = opts.churchPos ? [cx - 4, cz + 8] : [cx, cz];
  buildWell(map.batch, square[0] + 10, square[1] + 3, terrain);
  addLamp(map, cx - 12, cz + 10, terrain);
  addLamp(map, cx + 14, cz - 6, terrain);

  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    const x = cx + Math.cos(a) * 15;
    const z = cz + Math.sin(a) * 15;
    const y = terrain.heightAt(x, z);
    map.batch.addBox(0.14, 2.4, 0.14, x - 1.3, y + 1.2, z, 0, 'wood', true);
    map.batch.addBox(0.14, 2.4, 0.14, x + 1.3, y + 1.2, z, 0, 'wood', true);
    map.batch.addBox(2.8, 0.12, 1.6, x, y + 2.45, z, rng.range(-0.2, 0.2), 'roof', false);
    map.batch.addBox(2.2, 0.5, 1.1, x, y + 0.9, z, rng.range(0, 3), 'wood', true);
  }

  addFence(map, cx - 30, cz + 22, cx + 20, cz + 22, terrain);
  addFence(map, cx - 34, cz - 18, cx - 18, cz - 4, terrain);
  addLaundry(map, cx - 20, cz + 4, cx - 8, cz + 12, terrain);
  addLaundry(map, cx + 8, cz - 10, cx + 20, cz - 4, terrain);

  for (const p of opts.sandbags || []) {
    buildSandbagWall(map.batch, p.points, 1.0, terrain);
  }

  buildCart(map.batch, cx + 6, cz + 20, rng.range(0, Math.PI), terrain);
  buildCart(map.batch, cx - 18, cz - 12, rng.range(0, Math.PI), terrain);
  buildArtillery(map.batch, cx - 24, cz + 28, rng.range(-0.5, 0.5), terrain, map.assets);

  addRubble(map, cx + 26, cz - 18, 5, 12, terrain);
  addRubble(map, cx - 28, cz + 6, 4, 9, terrain);
}

export function buildTrenches(map, opts = {}) {
  const terrain = map.terrain;
  const trenches = opts.trenches || map.meta.terrain.trenches || [];
  for (const trench of trenches) {
    const pts = trench.points;
    const width = trench.width;
    // 出入口周圍不放置木牆與雜物，保留進出通道。
    const openings = trench.openings || [];
    const nearOpening = (x, z) => openings.some((o) => Math.hypot(x - o[0], z - o[1]) < o[2] * 1.9);
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const nx = dz / len;
      const nz = -dx / len;
      const steps = Math.max(1, Math.floor(len / 2));
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const x = a[0] + dx * t;
        const z = a[1] + dz * t;
        const y = terrain.heightAt(x, z);
        map.batch.addBox(2.4, 0.09, len / steps + 0.1, x, y + 0.06, z, angle, 'wood', true);
        if (nearOpening(x, z)) continue;
        map.batch.addBox(0.25, 1.5, len / steps, x + nx * (width / 2 + 0.2), y + 0.8, z + nz * (width / 2 + 0.2), angle, 'wood', true);
        map.batch.addBox(0.25, 1.5, len / steps, x - nx * (width / 2 + 0.2), y + 0.8, z - nz * (width / 2 + 0.2), angle, 'wood', true);
        map.batch.addBox(0.6, 0.4, len / steps, x - nx * (width / 2 - 0.2), y + 0.55, z - nz * (width / 2 - 0.2), angle, 'wood', false);
      }
    }

    for (let i = 1; i < pts.length - 1; i += 2) {
      const p = pts[i];
      const next = pts[i + 1] || pts[i - 1];
      const dx = next[0] - p[0];
      const dz = next[1] - p[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      if (nearOpening(p[0], p[1])) continue;
      const nx = dz / len;
      const nz = -dx / len;
      const angle = Math.atan2(dx, dz);
      const x = p[0] + nx * (width / 2 + 1.2);
      const z = p[1] + nz * (width / 2 + 1.2);
      const y = terrain.heightAt(p[0], p[1]);
      map.batch.addBox(2.2, 0.22, 4.2, x, y + 1.0, z, angle, 'wood', true, 0.32, 0);
      buildSandbagWall(map.batch, [[x - nx * 2, z - nz * 2], [x + nx * 2, z + nz * 2]], 1.1, terrain);
      map.batch.addBox(1.4, 1.2, 1.4, p[0] - nx * (width / 2 + 1.8), y + 0.9, p[1] - nz * (width / 2 + 1.8), angle, 'woodDark', true);
    }

    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const nx = dz / len;
      const nz = -dx / len;
      const count = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const x = a[0] + dx * t + nx * (width / 2 + 0.7);
        const z = a[1] + dz * t + nz * (width / 2 + 0.7);
        const y = terrain.heightAt(x, z);
        map.batch.addBox(0.14, 1.25, 0.14, x, y + 0.62, z, 0, 'woodDark', false);
        if (i < count - 1) {
          const x2 = a[0] + dx * ((i + 1.5) / count) + nx * (width / 2 + 0.7);
          const z2 = a[1] + dz * ((i + 1.5) / count) + nz * (width / 2 + 0.7);
          const y2 = terrain.heightAt(x2, z2);
          const wire = new THREE.BufferGeometry();
          wire.setAttribute('position', new THREE.Float32BufferAttribute([x, y + 0.5, z, x2, y2 + 0.5, z2, x, y + 0.7, z, x2, y2 + 0.7, z2, x, y + 0.9, z, x2, y2 + 0.9, z2], 3));
          map.group.add(new THREE.LineSegments(wire, map.assets.materials.wire));
        }
      }
    }
  }

  const sandbagLines = opts.sandbagLines || [];
  for (const line of sandbagLines) buildSandbagWall(map.batch, line, 1.0, terrain);

  if (opts.wire) {
    for (const line of opts.wire) buildBarbedWire(map.group, map.batch, map.assets, line, terrain);
  }
}

export function buildFort(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const base = terrain.heightAt(cx, cz);
  const half = 25;
  const h = opts.wallHeight ?? 5.5;
  const t = 1.8;

  const wall = (ax, az, bx, bz, openings = []) => addWallWithOpenings(map, ax, az, bx, bz, base, h, t, 'stone', openings);

  wall(cx - half, cz - half, cx - 4, cz - half);
  wall(cx + 4, cz - half, cx + half, cz - half);
  wall(cx - half, cz + half, cx - 4, cz + half);
  wall(cx + 4, cz + half, cx + half, cz + half);
  wall(cx - half, cz - half, cx - half, cz + half);
  wall(cx + half, cz - half, cx + half, cz + half);

  for (let i = 0; i < 14; i++) {
    const x = cx - half + (i + 0.5) * (half * 2 / 14);
    map.batch.addBox(1.3, 1.3, 0.9, x, base + h + 0.65, cz - half, 0, 'stone', false);
    map.batch.addBox(1.3, 1.3, 0.9, x, base + h + 0.65, cz + half, 0, 'stone', false);
  }
  for (let i = 0; i < 14; i++) {
    const z = cz - half + (i + 0.5) * (half * 2 / 14);
    map.batch.addBox(0.9, 1.3, 1.3, cx - half, base + h + 0.65, z, 0, 'stone', false);
    map.batch.addBox(0.9, 1.3, 1.3, cx + half, base + h + 0.65, z, 0, 'stone', false);
  }

  for (const [ox, oz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
    map.batch.addCylinder(4.2, 4.6, 9, cx + ox, base + 4.5, cz + oz, 0, 0, 0, 'stone', true, 10);
    map.batch.addCylinder(4.8, 4.8, 0.8, cx + ox, base + 9.2, cz + oz, 0, 0, 0, 'stone', false, 10);
  }

  map.batch.addBox(1.2, 6, 1.2, cx - 4.2, base + 3, cz + half, 0, 'woodDark', false);
  map.batch.addBox(1.2, 6, 1.2, cx + 4.2, base + 3, cz + half, 0, 'woodDark', false);
  map.batch.addBox(1.4, 4.5, 0.3, cx - 3.4, base + 2.25, cz + half - 0.4, -0.5, 'woodDark', false);
  map.batch.addBox(1.4, 4.5, 0.3, cx + 3.4, base + 2.25, cz + half - 0.4, 0.5, 'woodDark', false);
  map.batch.addBox(1.2, 6, 1.2, cx - 4.2, base + 3, cz - half, 0, 'woodDark', false);
  map.batch.addBox(1.2, 6, 1.2, cx + 4.2, base + 3, cz - half, 0, 'woodDark', false);

  for (let i = 0; i < 12; i++) {
    const y = base + (i + 1) * 0.45;
    map.batch.addBox(3.2, 0.45, 1.1, cx - 10, y, cz - 12 - i * 1.1, 0, 'stone', true);
  }
  for (let i = 0; i < 12; i++) {
    const y = base + (i + 1) * 0.45;
    map.batch.addBox(1.1, 0.45, 3.2, cx + 12 - i * 1.1, y, cz + 10, 0, 'stone', true);
  }

  map.batch.addBox(12, 0.3, 4, cx, base + h - 0.15, cz - half + 1.5, 0, 'wood', false);
  map.batch.addBox(4, 0.3, 12, cx - half + 1.5, base + h - 0.15, cz, 0, 'wood', false);

  addSandbagRing(map, cx - 8, cz + 10, 4.5, terrain);
  addSandbagRing(map, cx + 10, cz - 6, 4, terrain);
  buildArtillery(map.batch, cx - 6, cz + 12, -0.4, terrain, map.assets);
  buildArtillery(map.batch, cx + 8, cz - 8, 2.4, terrain, map.assets);
  addStaticCrates(map, cx + 4, cz + 12, base, 4);
  addStaticCrates(map, cx - 12, cz - 10, base, 3);
  addLamp(map, cx - 6, cz - 14, terrain);
  addRubble(map, cx + 14, cz + 12, 4, 9, terrain);

  const bannerGeo = new THREE.PlaneGeometry(1.2, 4);
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0x9a5f4d, side: THREE.DoubleSide, roughness: 0.9 });
  bannerMat.userData.owned = true;
  for (const [bx, bz] of [[cx - 10, cz - half + 0.5], [cx + 10, cz - half + 0.5]]) {
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(bx, base + h - 2.2, bz);
    map.group.add(banner);
  }
  map.banners = map.banners || [];
  map.banners.push(bannerMat);
}

export function buildStation(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const y = terrain.heightAt(cx, cz);
  map.batch.addBox(34, 0.5, 12, cx, y + 0.5, cz, 0, 'stone', true);
  map.batch.addBox(34, 0.4, 0.5, cx, y + 0.75, cz + 6, 0, 'stone', false);
  map.batch.addBox(34, 0.4, 0.5, cx, y + 0.75, cz - 6, 0, 'stone', false);

  buildRailway(map.batch, map.meta.features.railway.points, terrain);

  addBuilding(map, cx - 6, cz - 3, 18, 8, 6, 0, { stone: true, roof: true });
  map.batch.addBox(20, 0.4, 1.2, cx - 6, y + 6.4, cz + 5, 0, 'roof', false);

  map.batch.addBox(13, 2.6, 3, cx + 10, y + 2.1, cz + 2, 0, 'metalDark', true);
  map.batch.addBox(13, 0.5, 3.2, cx + 10, y + 3.5, cz + 2, 0, 'roof', false);
  for (const ox of [-4, 0, 4]) {
    map.batch.addCylinder(0.5, 0.5, 0.4, cx + 10 + ox, y + 0.8, cz + 2, 0, 0, Math.PI / 2, 'metalDark', false, 10);
  }

  addLamp(map, cx - 12, cz + 8, terrain);
  addLamp(map, cx + 12, cz - 8, terrain);
  addStaticCrates(map, cx + 12, cz + 7, y + 0.5, 5);
  buildBarrels(map.world, map.group, map.assets, map.rng, [
    { x: cx + 14, y: y + 0.5, z: cz + 6 },
    { x: cx + 15.2, y: y + 0.5, z: cz + 7.2 }
  ]);
  buildSandbagWall(map.batch, [[cx - 16, cz + 7], [cx - 10, cz + 7]], 1.1, terrain);
  addRubble(map, cx + 18, cz + 8, 3, 6, terrain);
}

export function buildVineyard(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const rng = map.rng;
  for (let row = 0; row < opts.rows; row++) {
    const z = cz - 16 + row * 4.6;
    const x0 = cx - 26;
    const x1 = cx + 20;
    const points = [];
    for (let x = x0; x <= x1; x += 4.5) {
      const y = terrain.heightAt(x, z);
      map.batch.addBox(0.12, 1.8, 0.12, x, y + 0.9, z, 0, 'wood', true);
      points.push(x, y + 1.65, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    map.group.add(new THREE.Line(geo, map.assets.materials.wire));
    for (let x = x0; x <= x1; x += 9) {
      const y = terrain.heightAt(x, z);
      map.batch.addBox(0.8, 0.8, 0.8, x + 1.2, y + 1.1, z, rng.range(0, 1), 'grass', false);
    }
  }

  addBuilding(map, cx + 9, cz + 18, 14, 9, 6, 0.2, { stone: true, roof: true });
  addBuilding(map, cx - 18, cz - 12, 8, 7, 5, -0.4, { stone: false, roof: false });
  buildCart(map.batch, cx + 2, cz - 22, 0.4, terrain);
  buildCart(map.batch, cx - 8, cz + 24, 2.2, terrain);
  addStaticCrates(map, cx + 18, cz + 20, terrain.heightAt(cx + 18, cz + 20), 4);
  addFence(map, cx - 30, cz - 22, cx + 26, cz - 22, terrain);
  addLamp(map, cx + 2, cz + 14, terrain);
  addRubble(map, cx - 22, cz + 14, 4, 7, terrain);
}

export function buildDepot(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const y = terrain.heightAt(cx, cz);
  addBuilding(map, cx - 4, cz - 6, 24, 12, 8, 0, { stone: true, roof: true });
  map.batch.addBox(26, 0.5, 14, cx - 4, y + 0.25, cz - 6, 0, 'stone', false);

  buildSandbagWall(map.batch, [[cx - 18, cz + 8], [cx + 2, cz + 8], [cx + 8, cz + 4]], 1.1, terrain);
  buildSandbagWall(map.batch, [[cx + 14, cz - 18], [cx + 20, cz - 6]], 1.0, terrain);

  for (let i = 0; i < 6; i++) {
    const x = cx + 10 + (i % 3) * 1.5;
    const z = cz + 10 + Math.floor(i / 3) * 1.5;
    map.batch.addBox(1.1, 1.1, 1.1, x, terrain.heightAt(x, z) + 0.55, z, 0, 'wood', true);
  }
  buildBarrels(map.world, map.group, map.assets, map.rng, [
    { x: cx + 18, y: terrain.heightAt(cx + 18, cz + 2), z: cz + 2 },
    { x: cx + 19, y: terrain.heightAt(cx + 19, cz + 3), z: cz + 3 },
    { x: cx - 20, y: terrain.heightAt(cx - 20, cz + 10), z: cz + 10 }
  ]);

  map.batch.addBox(5.5, 2.2, 2.4, cx + 22, terrain.heightAt(cx + 22, cz - 12) + 1.2, cz - 12, 0.2, 'metalDark', true);
  for (const [ox, oz] of [[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]]) {
    map.batch.addCylinder(0.5, 0.5, 0.4, cx + 22 + ox, terrain.heightAt(cx + 22, cz - 12) + 0.6, cz - 12 + oz, 0, 0, Math.PI / 2, 'metalDark', false, 10);
  }
  addLamp(map, cx + 10, cz + 12, terrain);
  addRubble(map, cx - 22, cz + 16, 5, 9, terrain);
}

export function buildMill(map, opts) {
  const [cx, cz] = opts.center;
  const terrain = map.terrain;
  const y = terrain.heightAt(cx, cz);
  addBuilding(map, cx + 4, cz - 2, 16, 10, 8, 0, { stone: true, roof: true });
  map.batch.addBox(18, 0.5, 12, cx + 4, y + 0.25, cz - 2, 0, 'stone', false);

  const wheelX = cx - 8;
  const wheelZ = cz - 2;
  const wheelY = terrain.heightAt(wheelX, wheelZ) + 1.8;
  map.batch.addBox(1.2, 1.2, 1.2, wheelX, wheelY, wheelZ, 0, 'woodDark', true);
  const wheelGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.8, 16);
  const wheel = new THREE.Mesh(wheelGeo, map.assets.materials.woodDark);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(wheelX, wheelY, wheelZ);
  wheel.castShadow = true;
  map.group.add(wheel);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.2, 0.25), map.assets.materials.wood);
    spoke.position.set(wheelX, wheelY + Math.cos(a) * 0, wheelZ);
    spoke.rotation.x = a;
    map.group.add(spoke);
  }
  map.animated = map.animated || [];
  map.animated.push((dt) => {
    wheel.rotation.x += dt * 1.2;
  });

  map.batch.addBox(2.2, 0.25, 6, cx - 10, y + 1.2, cz + 2, 0.3, 'wood', true);
  map.batch.addBox(1.6, 0.2, 1.6, cx + 10, y + 1.0, cz + 4, 0, 'stone', true);
  addStaticCrates(map, cx + 12, cz + 6, y, 4);
  buildBarrels(map.world, map.group, map.assets, map.rng, [
    { x: cx + 15, y, z: cz + 2 },
    { x: cx + 16, y, z: cz + 3 }
  ]);
  addLamp(map, cx + 12, cz + 10, terrain);
  addRubble(map, cx - 14, cz + 10, 4, 7, terrain);
}

export function buildBridge(map, opts) {
  const z = opts.z;
  const terrain = map.terrain;
  const river = map.meta.terrain.river;
  const leftBank = terrain.heightAt(-22, z);
  const rightBank = terrain.heightAt(22, z);
  const deckY = Math.max(leftBank, rightBank) + 0.4;
  const water = river.waterLevel;

  for (const side of [-1, 1]) {
    const x = side * 17;
    map.batch.addBox(6, 4.5, 8, x, deckY - 2.2, z, 0, 'stone', true);
    map.batch.addBox(6.5, 0.5, 9, x, deckY + 0.2, z, 0, 'stone', false);
    map.batch.addBox(1.2, 4.5, 1.2, side * 8, deckY - 2.4, z - 4, 0, 'stone', true);
    map.batch.addBox(1.2, 4.5, 1.2, side * 8, deckY - 2.4, z + 4, 0, 'stone', true);
  }
  map.batch.addBox(11, 0.5, 7, -10, deckY, z, 0, 'stone', true);
  map.batch.addBox(11, 0.5, 7, 10, deckY, z, 0, 'stone', true);
  map.batch.addBox(0.4, 1.2, 7, -15, deckY + 0.85, z, 0, 'stone', false);
  map.batch.addBox(0.4, 1.2, 7, 15, deckY + 0.85, z, 0, 'stone', false);

  map.batch.addBox(9.5, 0.18, 2.2, 0, deckY + 0.1, z, 0, 'wood', true);
  map.batch.addBox(9.5, 1.0, 0.12, 0, deckY + 0.65, z - 1.2, 0, 'wood', true);
  map.batch.addBox(9.5, 1.0, 0.12, 0, deckY + 0.65, z + 1.2, 0, 'wood', true);
  map.batch.addBox(0.4, 0.6, 3, -6.5, deckY - 0.2, z, 0, 'rubble', false);
  map.batch.addBox(0.6, 0.8, 2.5, 7.5, deckY - 0.4, z, 0.4, 'rubble', false);
  map.batch.addBox(1.2, 0.8, 1.2, 2, water - 0.2, z - 3, 0.3, 'rubble', false);
  map.batch.addBox(0.9, 0.6, 0.9, -3, water - 0.3, z + 4, 0.2, 'rubble', false);

  buildSandbagWall(map.batch, [[-20, z - 4], [-20, z + 4]], 1.0, terrain);
  buildSandbagWall(map.batch, [[20, z - 4], [20, z + 4]], 1.0, terrain);
}

export function buildFootbridge(map, opts) {
  const z = opts.z;
  const terrain = map.terrain;
  const left = terrain.heightAt(-15, z);
  const right = terrain.heightAt(15, z);
  const deckY = Math.max(left, right) + 0.25;
  for (let i = 0; i < 16; i++) {
    const x = -15 + i * 2;
    map.batch.addBox(2.0, 0.16, 3.4, x, deckY + Math.sin(i * 0.4) * 0.05, z, 0, 'wood', true);
  }
  for (let i = 0; i < 16; i += 2) {
    const x = -15 + i * 2;
    map.batch.addBox(0.1, 1.1, 0.1, x, deckY + 0.65, z - 1.6, 0, 'wood', true);
    map.batch.addBox(0.1, 1.1, 0.1, x, deckY + 0.65, z + 1.6, 0, 'wood', true);
  }
  map.batch.addBox(30, 0.08, 0.08, 0, deckY + 1.1, z - 1.6, 0, 'wood', false);
  map.batch.addBox(30, 0.08, 0.08, 0, deckY + 1.1, z + 1.6, 0, 'wood', false);
}

export function buildBarges(map, opts) {
  for (const [x, z] of opts.barges || []) {
    const y = map.meta.terrain.river.waterLevel - 0.2;
    map.batch.addBox(5, 0.5, 2.2, x, y, z, map.rng.range(-0.2, 0.2), 'wood', false);
    map.batch.addBox(0.4, 0.8, 2.2, x + 2.5, y + 0.4, z, 0, 'wood', false);
    map.batch.addBox(0.4, 0.8, 2.2, x - 2.5, y + 0.4, z, 0, 'wood', false);
    map.batch.addBox(0.8, 0.8, 0.8, x + 1, y + 0.6, z, 0.3, 'wood', false);
  }
}

export function buildRuinedTank(map, x, z, rotY) {
  const terrain = map.terrain;
  const y = terrain.heightAt(x, z);
  map.batch.addBox(2.8, 1.2, 5.2, x, y + 0.7, z, rotY, 'metalDark', true);
  map.batch.addBox(2.2, 0.8, 1.8, x + Math.sin(rotY) * 1.8, y + 1.1, z + Math.cos(rotY) * 1.8, rotY, 'metalDark', true);
  map.batch.addCylinder(0.14, 0.16, 2.6, x + Math.sin(rotY) * 2.2, y + 1.1, z + Math.cos(rotY) * 2.2, Math.PI / 2 - 0.15, rotY, 0, 'metalDark', false, 8);
  map.batch.addBox(2.6, 0.6, 1.4, x + Math.cos(rotY) * 2.5, y + 0.4, z - Math.sin(rotY) * 2.5, rotY, 'rubble', false);
}

export function buildAidStation(map, x, z, terrain) {
  const y = terrain.heightAt(x, z);
  map.batch.addBox(4, 2.4, 3, x, y + 1.2, z, 0, 'wood', true);
  map.batch.addBox(4.6, 0.2, 3.6, x, y + 2.5, z, 0, 'roof', false);
  map.batch.addBox(0.08, 0.8, 0.08, x, y + 1.8, z + 1.55, 0, 'metalDark', false);
  map.batch.addBox(0.6, 0.08, 0.08, x, y + 2.2, z + 1.55, 0, 'metalDark', false);
  map.batch.addBox(0.08, 0.6, 0.08, x - 0.3, y + 2.2, z + 1.55, 0, 'metalDark', false);
  addStaticCrates(map, x + 3, z + 2, y, 2);
}
