import * as THREE from 'three';
import { GADGETS } from '../config/weapons.js';

// 醫療包與彈藥箱：靠近時自動治療或補給。
export class Pickup {
  constructor(game, kind, pos, team = null) {
    this.game = game;
    this.kind = kind;
    this.pos = pos.clone();
    this.team = team;
    this.life = kind === 'medkit' ? GADGETS.medkit.life : Infinity;
    this.resupplyTimer = 0;
    this.mesh = new THREE.Group();
    this.mesh.position.copy(pos);
    this.game.scene.add(this.mesh);
    this.build();
  }

  build() {
    const a = this.game.assets;
    if (this.kind === 'medkit') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), a.materials.medic);
      box.position.y = 0.18;
      box.castShadow = true;
      this.mesh.add(box);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.02), a.materials.teamA);
      c1.position.set(0, 0.18, 0.21);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.02), a.materials.teamA);
      c2.position.set(0, 0.18, 0.21);
      this.mesh.add(c1, c2);
      this.glow = new THREE.Sprite(a.sprites.flash.clone());
      this.glow.material.color.setHex(0x8cff8c);
      this.glow.material.opacity = 0.35;
      this.glow.scale.set(1.4, 1.4, 1);
      this.glow.position.y = 0.4;
      this.mesh.add(this.glow);
    } else {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.65), a.materials.wood);
      crate.position.y = 0.28;
      crate.castShadow = true;
      this.mesh.add(crate);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.69), a.materials.metalDark);
      band.position.y = 0.28;
      this.mesh.add(band);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.04), a.materials.teamA);
      stripe.position.set(0, 0.4, 0.33);
      this.mesh.add(stripe);
    }
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dispose();
      return;
    }
    this.mesh.position.y = this.pos.y + Math.sin(this.game.time * 2) * 0.02;

    if (this.kind === 'medkit') {
      const radius = GADGETS.medkit.radius;
      for (const s of this.game.getSoldiers()) {
        if (s.team !== this.team || s.downed || s.dead) continue;
        if (s.getCenter().distanceTo(this.pos) < radius) {
          s.heal(GADGETS.medkit.healPerSecond * dt);
        }
      }
    } else {
      this.resupplyTimer -= dt;
      if (this.resupplyTimer <= 0) {
        this.resupplyTimer = 2;
        const p = this.game.player;
        if (p && !p.downed && !p.dead && p.getCenter().distanceTo(this.pos) < 2.8) {
          p.resupply();
        }
      }
    }
  }

  dispose() {
    this.dead = true;
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isSprite && o.material) o.material.dispose();
    });
  }
}
