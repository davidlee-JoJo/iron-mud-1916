import * as THREE from 'three';
import { clamp } from '../core/MathUtils.js';

// 在錐形範圍內隨機偏移方向，用於擴散與 AI 瞄準誤差。
export function spreadDirection(dir, angle) {
  if (angle <= 0.00001) return dir.clone();
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * Math.tan(angle);
  return dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
}

// 單把武器的彈藥、射速、換彈、栓動與擴散狀態。
export class Weapon {
  constructor(game, def, owner) {
    this.game = game;
    this.def = def;
    this.owner = owner;
    this.ammo = def.mag;
    this.reserve = def.reserve;
    this.reloading = false;
    this.reloadTimer = 0;
    this.nextFire = 0;
    this.bloom = 0;
    this.boltTimer = 0;
    this.ads = false;
    this.lastShot = -10;
  }

  reset() {
    this.ammo = this.def.mag;
    this.reserve = this.def.reserve;
    this.reloading = false;
    this.reloadTimer = 0;
    this.nextFire = 0;
    this.bloom = 0;
    this.boltTimer = 0;
    this.ads = false;
  }

  setAds(v) {
    this.ads = v;
  }

  canFire(now) {
    return !this.reloading && this.boltTimer <= 0 && now >= this.nextFire && this.ammo > 0;
  }

  tryFire(now, origin, dir, extraSpread = 0, muzzlePos = null) {
    if (!this.canFire(now)) return false;
    const def = this.def;
    this.ammo--;
    this.nextFire = now + 60 / def.rpm;
    if (def.type === 'bolt') this.boltTimer = def.boltTime;
    this.bloom = clamp(this.bloom + def.bloom, 0, def.maxBloom);
    this.lastShot = now;

    const spread = (this.ads ? def.spreadAds : def.spreadHip) + this.bloom + extraSpread;
    const finalDir = spreadDirection(dir, spread);
    const muzzle = muzzlePos || origin.clone().addScaledVector(dir, 0.6);

    this.game.combat.hitscan(origin, finalDir, def, this.owner, {
      muzzlePos: muzzle,
      isPlayer: !!this.owner.isPlayer
    });
    this.game.alertBots(this.owner, origin);

    if (this.owner.isPlayer || this.owner.position.distanceToSquared(this.game.camera.position) < 90 * 90) {
      this.game.audio.playGun(def.muzzle, this.owner.isPlayer ? null : this.owner.position, !!this.owner.isPlayer);
    }
    this.game.effects.muzzleFlash(muzzle, finalDir, !!this.owner.isPlayer);

    if (this.ammo === 0) this.startReload();
    return true;
  }

  startReload() {
    if (this.reloading || this.ammo >= this.def.mag || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = this.def.reload;
    this.game.audio.playReload(!!this.owner.isPlayer);
    return true;
  }

  finishReload() {
    const need = this.def.mag - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.reloading = false;
    this.reloadTimer = 0;
  }

  update(dt) {
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (this.boltTimer > 0) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0 && this.owner.isPlayer) this.game.audio.playBolt(true);
    }
    if (this.bloom > 0) this.bloom = Math.max(0, this.bloom - this.def.recover * dt);
  }

  resupply() {
    this.reserve = this.def.reserve;
    if (this.ammo < this.def.mag) this.ammo = this.def.mag;
  }

  get spread() {
    return (this.ads ? this.def.spreadAds : this.def.spreadHip) + this.bloom;
  }
}
