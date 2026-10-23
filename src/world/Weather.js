import * as THREE from 'three';
import { RNG } from '../core/Random.js';

// 天氣系統：雨絲、地面霧、塵埃、烏鴉與閃電。
export class Weather {
  constructor(scene, meta, assets, camera, quality = 'medium') {
    this.scene = scene;
    this.meta = meta;
    this.assets = assets;
    this.camera = camera;
    this.quality = quality;
    this.rng = new RNG(meta.seed + 41);
    this.rain = null;
    this.dust = null;
    this.mist = [];
    this.birds = [];
    this.birdTex = null;
    this.flash = 0;
    this.baseDir = 2.3;
    this.baseHemi = 0.55;
    this.dirLight = null;
    this.hemiLight = null;
    this.time = 0;
    this.build();
  }

  setLights(dir, hemi) {
    this.dirLight = dir;
    this.hemiLight = hemi;
    this.baseDir = dir.intensity;
    this.baseHemi = hemi.intensity;
  }

  build() {
    const weather = this.meta.weather;
    if (weather === 'rain') this.buildRain();
    if (weather === 'mist' || weather === 'rain') this.buildMist();
    if (weather !== 'rain') this.buildDust();
    if (this.meta.features.birds) this.buildBirds();
  }

  buildRain() {
    const count = this.quality === 'low' ? 2600 : this.quality === 'high' ? 7000 : 4800;
    this.rainCount = count;
    const positions = new Float32Array(count * 6);
    this.drops = [];
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: this.rng.range(-35, 35),
        y: this.rng.range(-6, 30),
        z: this.rng.range(-35, 35),
        speed: this.rng.range(24, 38)
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xaec6d8, transparent: true, opacity: 0.38, depthWrite: false });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  buildMist() {
    const count = this.meta.weather === 'rain' ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const mat = this.assets.sprites.smoke.clone();
      mat.color.setHex(this.meta.weather === 'rain' ? 0xb8c4cc : 0xc9bda8);
      mat.opacity = this.meta.weather === 'rain' ? 0.055 : 0.045;
      const sprite = new THREE.Sprite(mat);
      const x = this.rng.range(-120, 120);
      const z = this.rng.range(-120, 120);
      sprite.position.set(x, this.rng.range(1, 5), z);
      const s = this.rng.range(35, 70);
      sprite.scale.set(s, s * 0.5, 1);
      this.scene.add(sprite);
      this.mist.push({ sprite, baseX: x, baseZ: z, speed: this.rng.range(0.2, 0.5), phase: this.rng.range(0, 6) });
    }
  }

  buildDust() {
    const count = this.meta.weather === 'clear' ? 260 : 180;
    const positions = new Float32Array(count * 3);
    this.dustData = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = this.rng.range(-40, 40);
      positions[i * 3 + 1] = this.rng.range(0.5, 12);
      positions[i * 3 + 2] = this.rng.range(-40, 40);
      this.dustData.push({ phase: this.rng.range(0, 6), speed: this.rng.range(0.1, 0.4) });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe0d6c2,
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  buildBirds() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(20,20,18,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 40);
    ctx.quadraticCurveTo(24, 22, 32, 34);
    ctx.quadraticCurveTo(40, 22, 56, 40);
    ctx.stroke();
    this.birdTex = new THREE.CanvasTexture(c);
    this.birdTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: this.birdTex, transparent: true, depthWrite: false, color: 0x24241f, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const sprite = new THREE.Sprite(mat.clone());
      sprite.scale.set(1.6, 1.6, 1);
      this.scene.add(sprite);
      this.birds.push({
        sprite,
        radius: this.rng.range(50, 100),
        height: this.rng.range(26, 42),
        speed: this.rng.range(0.05, 0.12),
        phase: this.rng.range(0, Math.PI * 2)
      });
    }
  }

  triggerLightning() {
    this.flash = 1;
  }

  setQuality(q) {
    this.quality = q;
    if (this.rain) {
      const count = q === 'low' ? Math.floor(this.rainCount * 0.5) : q === 'high' ? this.rainCount : Math.floor(this.rainCount * 0.78);
      this.rain.geometry.setDrawRange(0, count * 2);
    }
  }

  update(dt) {
    this.time += dt;
    const cam = this.camera.position;

    if (this.rain) {
      const attr = this.rain.geometry.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y -= d.speed * dt;
        if (d.y < cam.y - 7) {
          d.y = cam.y + this.rng.range(18, 34);
          d.x = cam.x + this.rng.range(-35, 35);
          d.z = cam.z + this.rng.range(-35, 35);
        }
        arr[i * 6] = d.x;
        arr[i * 6 + 1] = d.y;
        arr[i * 6 + 2] = d.z;
        arr[i * 6 + 3] = d.x + 0.08;
        arr[i * 6 + 4] = d.y - 0.75;
        arr[i * 6 + 5] = d.z + 0.04;
      }
      attr.needsUpdate = true;
    }

    if (this.dust) {
      const attr = this.dust.geometry.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < this.dustData.length; i++) {
        const d = this.dustData[i];
        arr[i * 3 + 1] += Math.sin(this.time * 0.4 + d.phase) * dt * 0.08;
        arr[i * 3] += Math.cos(this.time * 0.2 + d.phase) * dt * 0.12;
        if (arr[i * 3] > cam.x + 45) arr[i * 3] = cam.x - 45;
        if (arr[i * 3] < cam.x - 45) arr[i * 3] = cam.x + 45;
        if (arr[i * 3 + 2] > cam.z + 45) arr[i * 3 + 2] = cam.z - 45;
        if (arr[i * 3 + 2] < cam.z - 45) arr[i * 3 + 2] = cam.z + 45;
      }
      attr.needsUpdate = true;
    }

    for (const m of this.mist) {
      m.sprite.position.x = m.baseX + Math.sin(this.time * m.speed + m.phase) * 18;
      m.sprite.position.z = m.baseZ + Math.cos(this.time * m.speed * 0.7 + m.phase) * 14;
    }

    for (const b of this.birds) {
      b.phase += dt * b.speed;
      b.sprite.position.set(
        Math.cos(b.phase) * b.radius,
        b.height + Math.sin(b.phase * 2) * 2,
        Math.sin(b.phase) * b.radius
      );
      b.sprite.material.rotation = Math.sin(b.phase * 6) * 0.2;
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4.5);
      if (this.dirLight) this.dirLight.intensity = this.baseDir + this.flash * 7;
      if (this.hemiLight) this.hemiLight.intensity = this.baseHemi + this.flash * 1.6;
    } else if (this.dirLight) {
      this.dirLight.intensity = this.baseDir;
      if (this.hemiLight) this.hemiLight.intensity = this.baseHemi;
    }
  }

  dispose() {
    if (this.rain) {
      this.scene.remove(this.rain);
      this.rain.geometry.dispose();
      this.rain.material.dispose();
    }
    if (this.dust) {
      this.scene.remove(this.dust);
      this.dust.geometry.dispose();
      this.dust.material.dispose();
    }
    for (const m of this.mist) {
      this.scene.remove(m.sprite);
      m.sprite.material.dispose();
    }
    for (const b of this.birds) {
      this.scene.remove(b.sprite);
      b.sprite.material.dispose();
    }
    if (this.birdTex) this.birdTex.dispose();
    this.mist = [];
    this.birds = [];
  }
}
