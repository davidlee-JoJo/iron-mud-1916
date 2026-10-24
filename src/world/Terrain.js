import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RNG } from '../core/Random.js';
import { createNoise2D, fbm, distanceToPolyline, clamp, smoothstep, lerp } from '../core/MathUtils.js';

// 程序化地形：基礎起伏、彈坑、戰壕、河流與 flatten 區域。
export class Terrain {
  constructor(meta) {
    this.meta = meta;
    this.size = meta.size;
    this.segments = meta.terrain.segments;
    this.res = this.segments + 1;
    this.step = this.size / this.segments;
    this.rng = new RNG(meta.seed + 17);
    this.noise = createNoise2D(meta.seed + 3);
    this.detailNoise = createNoise2D(meta.seed + 9);
    this.heights = new Float32Array(this.res * this.res);
    this.craters = [];
    this.waterLevel = meta.terrain.river ? meta.terrain.river.waterLevel : null;
    this.generateCraters();
    this.buildHeightGrid();
  }

  generateCraters() {
    const cfg = this.meta.terrain.craters;
    if (!cfg) return;
    for (let i = 0; i < cfg.count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(this.rng.next()) * cfg.area[2];
      this.craters.push({
        x: cfg.area[0] + Math.cos(a) * r,
        z: cfg.area[1] + Math.sin(a) * r,
        radius: this.rng.range(cfg.radius[0], cfg.radius[1]),
        depth: this.rng.range(cfg.depth[0], cfg.depth[1])
      });
    }
  }

  rawHeight(x, z) {
    const t = this.meta.terrain;
    let h = t.base + t.slopeZ * z;
    const n1 = fbm(this.noise, x * t.noiseScale, z * t.noiseScale, 4);
    const n2 = fbm(this.detailNoise, x * t.noiseScale * 4.1, z * t.noiseScale * 4.1, 2);
    h += (n1 - 0.5) * 2 * t.amplitude + (n2 - 0.5) * t.amplitude * 0.35;

    for (const zone of t.flatten || []) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < zone.r + zone.falloff) {
        const influence = 1 - smoothstep(zone.r, zone.r + zone.falloff, d);
        h = lerp(h, zone.h, influence);
      }
    }

    for (const c of this.craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.radius * 1.4) {
        const f = Math.exp(-(d * d) / (c.radius * c.radius * 0.42));
        h -= c.depth * f;
        if (d > c.radius * 0.7 && d < c.radius * 1.15) {
          h += c.depth * 0.22 * Math.exp(-Math.pow(d - c.radius * 0.92, 2) / 2.2);
        }
      }
    }

    for (const trench of t.trenches || []) {
      const d = distanceToPolyline(x, z, trench.points);
      if (d < trench.width * 0.5 + 1.6) {
        let f = 1 - smoothstep(trench.width * 0.5, trench.width * 0.5 + 1.6, d);
        // 出入口：指定點位周圍戰壕深度以 3 倍半徑緩和漸變為 0，
        // 形成可通行的坡道（坡度需低於 A* 的 1.0 高度差上限）。
        for (const o of trench.openings || []) {
          const od = Math.hypot(x - o[0], z - o[1]);
          if (od < o[2] * 3) f *= smoothstep(o[2], o[2] * 3, od);
        }
        h -= trench.depth * f;
      }
    }

    const river = t.river;
    if (river) {
      const d = distanceToPolyline(x, z, river.points);
      if (d < river.width * 0.5 + 16) {
        let bed = river.bed;
        for (const ford of river.fords || []) {
          if (Math.abs(z - ford.z) < ford.width * 0.5) bed = ford.bed;
        }
        const f = 1 - smoothstep(river.width * 0.5, river.width * 0.5 + 14, d);
        h = lerp(h, bed, f);
      }
    }

    return h;
  }

  buildHeightGrid() {
    const half = this.size / 2;
    for (let iz = 0; iz < this.res; iz++) {
      const z = -half + iz * this.step;
      for (let ix = 0; ix < this.res; ix++) {
        const x = -half + ix * this.step;
        this.heights[iz * this.res + ix] = this.rawHeight(x, z);
      }
    }
  }

  heightAt(x, z) {
    const half = this.size / 2;
    const gx = clamp((x + half) / this.step, 0, this.res - 1.001);
    const gz = clamp((z + half) / this.step, 0, this.res - 1.001);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const i00 = iz * this.res + ix;
    const i10 = i00 + 1;
    const i01 = i00 + this.res;
    const i11 = i01 + 1;
    const h0 = lerp(this.heights[i00], this.heights[i10], fx);
    const h1 = lerp(this.heights[i01], this.heights[i11], fx);
    return lerp(h0, h1, fz);
  }

  slopeAt(x, z) {
    const d = 1.5;
    const dx = this.heightAt(x + d, z) - this.heightAt(x - d, z);
    const dz = this.heightAt(x, z + d) - this.heightAt(x, z - d);
    return Math.hypot(dx, dz) / (2 * d);
  }

  isDeepWater(x, z) {
    if (!this.meta.terrain.river) return false;
    return this.heightAt(x, z) < this.waterLevel - 1.05;
  }

  isWater(x, z) {
    if (!this.meta.terrain.river) return false;
    return this.heightAt(x, z) < this.waterLevel - 0.05;
  }

  surfaceAt(x, z) {
    if (this.isWater(x, z)) return 'water';
    return 'mud';
  }

  colorAt(x, z, height, slope) {
    const p = this.meta.palette;
    const n = fbm(this.detailNoise, x * 0.09, z * 0.09, 3);
    const c = new THREE.Color(p.mud);
    const dark = new THREE.Color(p.mudDark);
    const grass = new THREE.Color(p.grass);
    const rock = new THREE.Color(p.rock);
    const road = new THREE.Color(p.road);
    const crater = new THREE.Color(p.crater);

    c.lerp(dark, clamp((0.55 - n) * 1.4, 0, 0.7));
    if (slope < 0.22) c.lerp(grass, clamp((n - 0.45) * 1.5, 0, 0.55));
    if (slope > 0.32) c.lerp(rock, clamp((slope - 0.32) * 1.6, 0, 0.6));

    for (const cr of this.craters) {
      const d = Math.hypot(x - cr.x, z - cr.z);
      if (d < cr.radius * 1.05) c.lerp(crater, 0.45 * (1 - d / (cr.radius * 1.05)));
    }

    for (const r of this.meta.terrain.roads || []) {
      const d = distanceToPolyline(x, z, r.points);
      if (d < r.width * 0.5 + 1.2) {
        c.lerp(road, 1 - smoothstep(r.width * 0.5, r.width * 0.5 + 1.2, d));
      }
    }

    if (this.meta.terrain.river) {
      const d = distanceToPolyline(x, z, this.meta.terrain.river.points);
      if (d < this.meta.terrain.river.width * 0.5 + 10) {
        c.lerp(dark, 0.45);
      }
    }

    c.multiplyScalar(1.18 + n * 0.1);
    return c;
  }

  build(assets) {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const half = this.size / 2;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      const slope = this.slopeAt(x, z);
      const c = this.colorAt(x, z, y, slope);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, assets.materials.terrain);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';

    const vertices = new Float32Array(pos.array);
    const indices = new Uint32Array(geo.index.array);
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

    let water = null;
    if (this.meta.terrain.river) {
      const waterGeo = new THREE.PlaneGeometry(this.size + 20, this.size + 20, 1, 1);
      waterGeo.rotateX(-Math.PI / 2);
      water = new THREE.Mesh(waterGeo, assets.materials.water);
      water.position.y = this.waterLevel;
      water.receiveShadow = true;
      water.renderOrder = 1;
      water.name = 'water';
    }

    return { mesh, water, colliderDesc, half };
  }
}
