import * as THREE from 'three';
import { RNG } from '../core/Random.js';
import { clamp } from '../core/MathUtils.js';

// 曳光彈、彈孔、火花、血霧、槍口火光與爆炸，全部使用物件池。
export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.assets = game.assets;
    this.rng = new RNG(777);
    this.tracers = [];
    this.decals = [];
    this.particles = [];
    this.smokePuffs = [];
    this.explosionSpheres = [];
    this.muzzle = null;
    this.muzzleLight = null;
    this.explosionLight = null;
    this.build();
  }

  build() {
    for (let i = 0; i < 50; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const mat = this.assets.sprites.tracer.clone();
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracers.push({ line, life: 0, maxLife: 0.07 });
    }

    const decalGeo = new THREE.PlaneGeometry(0.38, 0.38);
    for (let i = 0; i < 80; i++) {
      const mesh = new THREE.Mesh(decalGeo, this.assets.sprites.impact);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.decals.push({ mesh, life: 0 });
    }

    for (let i = 0; i < 140; i++) {
      const mat = this.assets.sprites.spark.clone();
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.particles.push({ sprite, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, gravity: 9, grow: 0 });
    }

    for (let i = 0; i < 50; i++) {
      const mat = this.assets.sprites.smoke.clone();
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.smokePuffs.push({ sprite, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1.6, size: 1 });
    }

    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffb35a,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.explosionSpheres.push({ mesh, life: 0, maxLife: 0.35, radius: 4 });
    }

    this.muzzleLight = new THREE.PointLight(0xffc06a, 0, 18, 2);
    this.scene.add(this.muzzleLight);
    this.explosionLight = new THREE.PointLight(0xff9a40, 0, 45, 2);
    this.scene.add(this.explosionLight);
  }

  tracer(from, to) {
    const t = this.tracers.find((x) => x.life <= 0);
    if (!t) return;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.visible = true;
    t.life = 0.07;
    t.line.material.opacity = 0.9;
  }

  impact(point, normal) {
    this.spawnParticles(point, normal, 4, 0xffd08a, 2.4);
    const d = this.decals.find((x) => x.life <= 0);
    if (d) {
      d.mesh.visible = true;
      d.mesh.position.copy(point).addScaledVector(normal, 0.025);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
      d.mesh.quaternion.copy(q);
      d.mesh.rotateZ(this.rng.range(0, Math.PI * 2));
      d.life = 28;
    }
  }

  sparks(point, normal) {
    this.spawnParticles(point, normal, 7, 0xffe0a0, 3.6);
  }

  blood(point, dir) {
    this.spawnParticles(point, dir, 5, 0x7a1510, 3.2);
  }

  spawnParticles(point, normal, count, color, speed) {
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((x) => x.life <= 0);
      if (!p) return;
      p.sprite.material.color.setHex(color);
      p.sprite.material.opacity = 0.9;
      p.sprite.visible = true;
      p.sprite.position.copy(point).addScaledVector(normal, 0.05);
      p.sprite.scale.set(0.1, 0.1, 1);
      p.vx = normal.x * speed * this.rng.range(0.3, 1) + this.rng.range(-1.5, 1.5);
      p.vy = normal.y * speed * this.rng.range(0.3, 1) + this.rng.range(0.5, 2.5);
      p.vz = normal.z * speed * this.rng.range(0.3, 1) + this.rng.range(-1.5, 1.5);
      p.life = 0.45;
      p.maxLife = 0.45;
      p.gravity = 9;
      p.grow = 0;
    }
  }

  muzzleFlash(pos, dir, isPlayer) {
    if (!this.muzzle) {
      this.muzzle = new THREE.Sprite(this.assets.sprites.flash.clone());
      this.scene.add(this.muzzle);
    }
    this.muzzle.visible = true;
    this.muzzle.position.copy(pos).addScaledVector(dir, 0.15);
    const s = isPlayer ? 0.7 : 1.1;
    this.muzzle.scale.set(s, s, 1);
    this.muzzle.material.opacity = 1;
    this.muzzleLife = 0.055;
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = isPlayer ? 5 : 8;
    this.muzzleLightLife = 0.055;
  }

  smokePuff(pos, color = 0x8a8378, size = 2) {
    const s = this.smokePuffs.find((x) => !x.sprite.visible);
    if (!s) return;
    s.sprite.material.color.setHex(color);
    s.sprite.material.opacity = 0.45;
    s.sprite.visible = true;
    s.sprite.position.copy(pos);
    s.vx = this.rng.range(-0.4, 0.4);
    s.vy = this.rng.range(1.2, 2.4);
    s.vz = this.rng.range(-0.4, 0.4);
    s.size = size;
    s.sprite.scale.set(size, size, 1);
    s.life = 0;
    s.maxLife = this.rng.range(1.0, 1.8);
  }

  explosion(pos, radius) {
    const sphere = this.explosionSpheres.find((x) => x.life <= 0);
    if (sphere) {
      sphere.mesh.visible = true;
      sphere.mesh.position.copy(pos);
      sphere.mesh.scale.setScalar(0.5);
      sphere.mesh.material.opacity = 0.9;
      sphere.radius = radius;
      sphere.life = 0.35;
      sphere.maxLife = 0.35;
    }
    this.explosionLight.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    this.explosionLight.intensity = 55;
    this.explosionLightLife = 0.3;

    for (let i = 0; i < 18; i++) {
      const p = this.particles.find((x) => x.life <= 0);
      if (!p) break;
      p.sprite.material.color.setHex(i % 2 === 0 ? 0xffd27a : 0xff7a3a);
      p.sprite.material.opacity = 0.95;
      p.sprite.visible = true;
      p.sprite.position.copy(pos);
      p.sprite.scale.set(0.25, 0.25, 1);
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(2, 9);
      p.vx = Math.cos(a) * r;
      p.vy = this.rng.range(2, 8);
      p.vz = Math.sin(a) * r;
      p.life = this.rng.range(0.5, 1.1);
      p.maxLife = p.life;
      p.gravity = 6;
      p.grow = 0;
    }

    for (let i = 0; i < 8; i++) {
      const s = this.smokePuffs.find((x) => x.life <= 0);
      if (!s) break;
      s.sprite.material.color.setHex(0x8a8378);
      s.sprite.material.opacity = 0.55;
      s.sprite.visible = true;
      s.sprite.position.copy(pos);
      const a = this.rng.range(0, Math.PI * 2);
      s.vx = Math.cos(a) * this.rng.range(1, 4);
      s.vy = this.rng.range(1.5, 4);
      s.vz = Math.sin(a) * this.rng.range(1, 4);
      s.size = this.rng.range(1.5, 3);
      s.sprite.scale.set(s.size, s.size, 1);
      s.life = 0;
      s.maxLife = this.rng.range(1.2, 2.2);
    }
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    }

    for (const d of this.decals) {
      if (d.life > 0) {
        d.life -= dt;
        if (d.life <= 0) d.mesh.visible = false;
      }
    }

    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) p.sprite.visible = false;
    }

    for (const s of this.smokePuffs) {
      if (!s.sprite.visible) continue;
      s.life += dt;
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.y += s.vy * dt;
      s.sprite.position.z += s.vz * dt;
      s.vx *= 1 - dt * 0.8;
      s.vz *= 1 - dt * 0.8;
      const t = clamp(s.life / s.maxLife, 0, 1);
      s.sprite.scale.setScalar(s.size + t * 5);
      s.sprite.material.opacity = 0.55 * (1 - t);
      if (s.life >= s.maxLife) s.sprite.visible = false;
    }

    for (const e of this.explosionSpheres) {
      if (e.life > 0) {
        e.life -= dt;
        const t = 1 - e.life / e.maxLife;
        e.mesh.scale.setScalar(e.radius * (0.25 + t * 1.1));
        e.mesh.material.opacity = 0.85 * (1 - t);
        if (e.life <= 0) e.mesh.visible = false;
      }
    }

    if (this.muzzle && this.muzzle.visible) {
      this.muzzleLife -= dt;
      this.muzzle.material.opacity = Math.max(0, this.muzzleLife / 0.055);
      if (this.muzzleLife <= 0) this.muzzle.visible = false;
    }
    if (this.muzzleLightLife > 0) {
      this.muzzleLightLife -= dt;
      this.muzzleLight.intensity = Math.max(0, this.muzzleLightLife / 0.055) * 8;
    }
    if (this.explosionLightLife > 0) {
      this.explosionLightLife -= dt;
      this.explosionLight.intensity = Math.max(0, this.explosionLightLife / 0.3) * 55;
    }
  }

  dispose() {
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
    for (const d of this.decals) {
      this.scene.remove(d.mesh);
    }
    for (const p of this.particles) {
      this.scene.remove(p.sprite);
      p.sprite.material.dispose();
    }
    for (const s of this.smokePuffs) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
    for (const e of this.explosionSpheres) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
    }
    if (this.muzzle) {
      this.scene.remove(this.muzzle);
      this.muzzle.material.dispose();
    }
    this.scene.remove(this.muzzleLight);
    this.scene.remove(this.explosionLight);
  }
}
