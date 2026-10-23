import * as THREE from 'three';
import { RNG } from './Random.js';

// 所有貼圖與材質都在這裡程序化生成，不依賴外部美術資產。
const cacheCanvas = (size = 128) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
};

const textureFromCanvas = (canvas, repeat = 1) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

const fillNoise = (ctx, size, base, variance, seed) => {
  const rgb = hexToRgb(base);
  const rng = new RNG(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rng.next() - 0.5) * variance;
    img.data[i * 4 + 0] = Math.max(0, Math.min(255, rgb.r + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, rgb.g + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, rgb.b + n));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

const drawMud = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#6b5a46', 30, 11);
  const rng = new RNG(12);
  for (let i = 0; i < 42; i++) {
    ctx.fillStyle = `rgba(42,34,24,${0.06 + rng.next() * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(rng.range(0, size), rng.range(0, size), rng.range(2, 18), rng.range(1, 9), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(130,120,96,${0.15 + rng.next() * 0.3})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3));
  }
  return c;
};

const drawMudDetail = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#ddd6c8', 22, 13);
  const rng = new RNG(14);
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = `rgba(150,140,120,${0.04 + rng.next() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rng.range(0, size), rng.range(0, size), rng.range(2, 16), rng.range(1, 8), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(240,232,214,${0.08 + rng.next() * 0.14})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3));
  }
  return c;
};

const drawWood = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#6d4d30', 20, 21);
  const rng = new RNG(22);
  const plank = size / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(30,20,12,${0.18 + rng.next() * 0.2})`;
    ctx.fillRect(i * plank, 0, 2, size);
    for (let j = 0; j < 12; j++) {
      ctx.strokeStyle = `rgba(40,26,14,${0.1 + rng.next() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(i * plank + rng.range(2, plank - 2), 0);
      ctx.bezierCurveTo(i * plank + rng.range(0, plank), size * 0.3, i * plank + rng.range(0, plank), size * 0.7, i * plank + rng.range(2, plank - 2), size);
      ctx.stroke();
    }
  }
  return c;
};

const drawStone = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#8b8477', 26, 31);
  const rng = new RNG(32);
  const row = size / 6;
  const brick = size / 4;
  ctx.strokeStyle = 'rgba(38,34,28,0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 6; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * row);
    ctx.lineTo(size, y * row);
    ctx.stroke();
    const off = (y % 2) * brick * 0.5;
    for (let x = 0; x < 4; x++) {
      ctx.beginPath();
      ctx.moveTo(x * brick + off, y * row);
      ctx.lineTo(x * brick + off, (y + 1) * row);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(20,18,14,${0.08 + rng.next() * 0.16})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(4, 18), rng.range(1, 3));
  }
  return c;
};

const drawSandbag = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#99855d', 28, 41);
  const rng = new RNG(42);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 3; x++) {
      ctx.strokeStyle = 'rgba(60,50,30,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x * size / 3 + size / 6, y * size / 4 + size / 8, size / 7, size / 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = `rgba(120,104,70,${0.2 + rng.next() * 0.3})`;
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 4), rng.range(1, 2));
  }
  return c;
};

const drawMetal = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#4a4c4b', 22, 51);
  const rng = new RNG(52);
  for (let i = 0; i < 24; i++) {
    ctx.strokeStyle = `rgba(140,140,135,${0.08 + rng.next() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(rng.range(0, size), rng.range(0, size));
    ctx.lineTo(rng.range(0, size), rng.range(0, size));
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(20,20,18,${0.2 + rng.next() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rng.range(0, size), rng.range(0, size), rng.range(1, 4), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
};

const drawRoof = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  fillNoise(ctx, size, '#433a34', 18, 61);
  const rng = new RNG(62);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = `rgba(25,20,18,${0.2 + rng.next() * 0.25})`;
      ctx.fillRect(x * size / 8, y * size / 8, size / 8 - 1, size / 8 - 1);
    }
  }
  return c;
};

const drawPoster = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#8e2f24';
  ctx.fillRect(0, 0, size, size * 0.18);
  ctx.fillStyle = '#2c2a25';
  ctx.font = 'bold 14px serif';
  ctx.fillText('前進', 10, 34);
  ctx.fillStyle = '#7a6a4d';
  ctx.fillRect(12, 52, size - 24, 6);
  ctx.fillRect(12, 64, size - 24, 6);
  ctx.fillRect(12, 76, size - 34, 6);
  ctx.strokeStyle = '#2c2a25';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, size - 12, size - 12);
  return c;
};

const drawImpact = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(8,7,5,0.95)');
  g.addColorStop(0.35, 'rgba(28,24,18,0.8)');
  g.addColorStop(1, 'rgba(28,24,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const rng = new RNG(71);
  ctx.strokeStyle = 'rgba(18,16,12,0.6)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    const a = rng.range(0, Math.PI * 2);
    ctx.lineTo(size / 2 + Math.cos(a) * rng.range(8, size / 2), size / 2 + Math.sin(a) * rng.range(8, size / 2));
    ctx.stroke();
  }
  return c;
};

const drawRadial = (size, inner, outer) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
};

const drawSmoke = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  const rng = new RNG(81);
  for (let i = 0; i < 18; i++) {
    const x = rng.range(size * 0.2, size * 0.8);
    const y = rng.range(size * 0.2, size * 0.8);
    const r = rng.range(size * 0.08, size * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(190,185,175,${0.06 + rng.next() * 0.1})`);
    g.addColorStop(1, 'rgba(190,185,175,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
};

const drawFlash = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,215,130,0.9)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,245,200,0.9)';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? size * 0.48 : size * 0.14;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  return c;
};

const drawBlood = (size) => {
  const c = cacheCanvas(size);
  const ctx = c.getContext('2d');
  const rng = new RNG(91);
  for (let i = 0; i < 12; i++) {
    const x = rng.range(size * 0.2, size * 0.8);
    const y = rng.range(size * 0.2, size * 0.8);
    ctx.fillStyle = `rgba(${100 + rng.int(0, 40)},${10 + rng.int(0, 15)},${8 + rng.int(0, 10)},${0.4 + rng.next() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, rng.range(2, 14), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
};

export class Assets {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.sprites = {};
    this.letterCache = new Map();
    this.disposables = [];
  }

  init() {
    const mudTex = textureFromCanvas(drawMud(256), 18);
    const detailTex = textureFromCanvas(drawMudDetail(256), 18);
    const woodTex = textureFromCanvas(drawWood(256), 3);
    const stoneTex = textureFromCanvas(drawStone(256), 4);
    const sandbagTex = textureFromCanvas(drawSandbag(128), 1);
    const metalTex = textureFromCanvas(drawMetal(128), 2);
    const roofTex = textureFromCanvas(drawRoof(128), 4);
    const posterTex = textureFromCanvas(drawPoster(128), 1);
    const impactTex = textureFromCanvas(drawImpact(64), 1);
    const smokeTex = textureFromCanvas(drawSmoke(128), 1);
    const flashTex = textureFromCanvas(drawFlash(128), 1);
    const sparkTex = textureFromCanvas(drawRadial(64, 'rgba(255,240,190,1)', 'rgba(255,140,40,0)'), 1);
    const bloodTex = textureFromCanvas(drawBlood(64), 1);

    this.textures = { mudTex, detailTex, woodTex, stoneTex, sandbagTex, metalTex, roofTex, posterTex, impactTex, smokeTex, flashTex, sparkTex, bloodTex };

    const m = this.materials;
    m.terrain = new THREE.MeshStandardMaterial({ map: detailTex, color: new THREE.Color(1.22, 1.22, 1.22), vertexColors: true, roughness: 0.96, metalness: 0.02, flatShading: true });
    m.wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0.02 });
    m.woodDark = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6a5a48, roughness: 0.9 });
    m.stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, metalness: 0.02 });
    m.stoneDark = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x8a8377, roughness: 0.95 });
    m.sandbag = new THREE.MeshStandardMaterial({ map: sandbagTex, roughness: 0.95 });
    m.metal = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.55 });
    m.metalDark = new THREE.MeshStandardMaterial({ map: metalTex, color: 0x5d5a52, roughness: 0.6, metalness: 0.5 });
    m.roof = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.9 });
    m.rubble = new THREE.MeshStandardMaterial({ color: 0x6d6558, roughness: 0.98, flatShading: true });
    m.poster = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.9 });
    m.glass = new THREE.MeshStandardMaterial({ color: 0x9fb6bf, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.35 });
    m.water = new THREE.MeshStandardMaterial({ color: 0x3d5560, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.78 });
    m.wire = new THREE.LineBasicMaterial({ color: 0x39382f, transparent: true, opacity: 0.9 });
    m.grass = new THREE.MeshStandardMaterial({ color: 0x6d7042, roughness: 1, flatShading: true });
    m.tree = new THREE.MeshStandardMaterial({ color: 0x3c3228, roughness: 1, flatShading: true });
    m.leaf = new THREE.MeshStandardMaterial({ color: 0x4d4a2c, roughness: 1, flatShading: true });
    m.skin = new THREE.MeshStandardMaterial({ color: 0xa57c5b, roughness: 0.9 });
    m.boots = new THREE.MeshStandardMaterial({ color: 0x2b241c, roughness: 0.95 });
    m.leather = new THREE.MeshStandardMaterial({ color: 0x5a432d, roughness: 0.9 });
    m.teamA = new THREE.MeshStandardMaterial({ color: 0x5b7692, roughness: 0.85 });
    m.teamB = new THREE.MeshStandardMaterial({ color: 0x9a5f4d, roughness: 0.85 });
    m.helmetA = new THREE.MeshStandardMaterial({ color: 0x4d6478, roughness: 0.7, metalness: 0.3 });
    m.helmetB = new THREE.MeshStandardMaterial({ color: 0x7d5145, roughness: 0.7, metalness: 0.3 });
    m.medic = new THREE.MeshStandardMaterial({ color: 0x6d8f62, roughness: 0.85 });
    m.engineer = new THREE.MeshStandardMaterial({ color: 0x9a8b4f, roughness: 0.85 });
    m.scout = new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.85 });
    m.rifle = new THREE.MeshStandardMaterial({ map: metalTex, color: 0x3d3c38, roughness: 0.5, metalness: 0.6 });
    m.stock = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x7a5a3b, roughness: 0.8 });
    m.emissiveLamp = new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xff9a45, emissiveIntensity: 2.2, roughness: 0.4 });
    m.fire = new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });

    this.sprites.smoke = new THREE.SpriteMaterial({ map: smokeTex, color: 0xb9b4a8, transparent: true, opacity: 0.5, depthWrite: false });
    this.sprites.fire = new THREE.SpriteMaterial({ map: sparkTex, color: 0xff8a3d, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sprites.flash = new THREE.SpriteMaterial({ map: flashTex, color: 0xffe0a0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sprites.spark = new THREE.SpriteMaterial({ map: sparkTex, color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sprites.blood = new THREE.SpriteMaterial({ map: bloodTex, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });

    this.sprites.tracer = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.sprites.impact = new THREE.MeshBasicMaterial({ map: impactTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

    this.disposables = [mudTex, detailTex, woodTex, stoneTex, sandbagTex, metalTex, roofTex, posterTex, impactTex, smokeTex, flashTex, sparkTex, bloodTex];
  }

  teamMaterial(team) {
    return team === 'A' ? this.materials.teamA : this.materials.teamB;
  }

  helmetMaterial(team) {
    return team === 'A' ? this.materials.helmetA : this.materials.helmetB;
  }

  letterSprite(letter) {
    if (this.letterCache.has(letter)) return this.letterCache.get(letter);
    const size = 128;
    const c = cacheCanvas(size);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.font = 'bold 86px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(10,10,8,0.85)';
    ctx.strokeText(letter, size / 2, size / 2 + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(letter, size / 2, size / 2 + 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
    this.letterCache.set(letter, mat);
    this.disposables.push(tex);
    return mat;
  }

  dispose() {
    for (const mat of Object.values(this.materials)) {
      if (mat && mat.dispose) mat.dispose();
    }
    for (const spr of Object.values(this.sprites)) {
      if (spr && spr.dispose) spr.dispose();
    }
    for (const tex of this.disposables) {
      if (tex && tex.dispose) tex.dispose();
    }
    this.letterCache.clear();
  }
}
