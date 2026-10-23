import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME } from '../config/game.js';
import { clamp, damp } from '../core/MathUtils.js';
import { spreadDirection } from '../weapons/Weapon.js';

// 載具基底：動態剛體、裝甲、駕駛進出、維修、損壞與重生。
export class Vehicle {
  constructor(game, opts) {
    this.game = game;
    this.assets = game.assets;
    this.type = opts.type;
    this.team = opts.team;
    this.spawnPos = new THREE.Vector3(opts.pos[0], opts.y ?? 0, opts.pos[1]);
    this.spawnRot = opts.rot ?? 0;
    this.maxHp = opts.maxHp;
    this.hp = this.maxHp;
    this.destroyed = false;
    this.disabled = false;
    this.driver = null;
    this.turretYaw = 0;
    this.turretPitch = 0;
    this.aimYaw = 0;
    this.cannonReload = 0;
    this.mgCooldown = 0;
    this.bodyHeight = opts.bodyHeight;
    this.colliders = [];
    this.respawnTimer = 0;
    this.smokeTimer = 0;
    this.roadkillTimer = 0;
    this.engine = null;
    this.mesh = new THREE.Group();
    this.mesh.name = opts.name || 'vehicle';
    this.game.scene.add(this.mesh);
    this.buildMesh();
    this.createBody(opts);
    this.engine = null;
  }

  ensureEngine() {
    if (!this.engine && this.game.audio.ctx) {
      this.engine = this.game.audio.createEngine(this.getCenter());
    }
  }

  createBody(opts) {
    const world = this.game.physicsWorld;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.spawnRot, 0));
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.spawnPos.x, this.spawnPos.y + this.bodyHeight, this.spawnPos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.5)
        .setAngularDamping(1.6)
    );
    this.body.setEnabledRotations(false, true, false, true);
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(opts.half.x, opts.half.y, opts.half.z).setMass(opts.mass).setFriction(0.8).setRestitution(0.05),
      this.body
    );
    this.colliders = [this.collider];
    this.game.registry.add(this.collider, this, 'vehicle');
    this.half = opts.half;
  }

  buildMesh() {
    // 子類別覆寫。
  }

  getCenter() {
    if (!this.body) return this.spawnPos.clone();
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  getForward() {
    const q = this.body.rotation();
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    return new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  }

  getRight() {
    const q = this.body.rotation();
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    return new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  }

  getYaw() {
    const q = this.body.rotation();
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    const e = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    return e.y;
  }

  getExitPosition() {
    const center = this.getCenter();
    const right = this.getRight();
    const back = this.getForward().multiplyScalar(-1);
    for (const offset of [
      right.clone().multiplyScalar(3.6),
      right.clone().multiplyScalar(-3.6),
      back.clone().multiplyScalar(4.5)
    ]) {
      const p = center.clone().add(offset);
      p.y = this.game.world.heightAt(p.x, p.z) + 0.15;
      if (!this.game.world.isDeepWater(p.x, p.z)) return p;
    }
    return new THREE.Vector3(center.x, this.game.world.heightAt(center.x, center.z) + 0.2, center.z);
  }

  enter(player) {
    if (this.destroyed || this.driver || player.team !== this.team) return false;
    this.driver = player;
    return true;
  }

  exit() {
    this.driver = null;
  }

  updateLook(dt) {
    if (!this.driver || !this.driver.isPlayer) return;
    const input = this.game.input;
    const sens = this.game.settings.sensitivity * 0.85;
    const mouse = input.consumeMouseDelta();
    if (this.type === 'tank') {
      this.turretYaw -= mouse.x * sens;
      this.turretPitch -= mouse.y * sens * 0.7;
      this.turretPitch = clamp(this.turretPitch, -0.12, 0.32);
      this.turretYaw = clamp(this.turretYaw, -Math.PI * 0.95, Math.PI * 0.95);
    } else {
      this.aimYaw -= mouse.x * sens;
      this.aimYaw = clamp(this.aimYaw, -1.2, 1.2);
    }
  }

  updatePhysics(dt) {
    if (!this.body || this.destroyed) return;
    const input = this.game.input;
    const isPlayerDriver = this.driver && this.driver.isPlayer;
    let throttle = 0;
    let steer = 0;
    if (isPlayerDriver) {
      if (input.isDown('KeyW')) throttle += 1;
      if (input.isDown('KeyS')) throttle -= 1;
      // Three.js 的 Y 軸正角速度是向左轉，因此 A 為正、D 為負。
      if (input.isDown('KeyA')) steer += 1;
      if (input.isDown('KeyD')) steer -= 1;
    }
    const forward = this.getForward();
    const speedMul = this.disabled ? 0.55 : 1;
    const deep = this.game.world.isDeepWater(this.getCenter().x, this.getCenter().z);
    const maxSpeed = (this.type === 'tank' ? 10 : 16) * speedMul * (deep ? 0.35 : 1);
    const desired = throttle * maxSpeed;
    const lv = this.body.linvel();
    const desiredX = forward.x * desired;
    const desiredZ = forward.z * desired;
    const accel = this.type === 'tank' ? 4.2 : 7.5;
    this.body.setLinvel({
      x: damp(lv.x, desiredX, accel, dt),
      y: lv.y,
      z: damp(lv.z, desiredZ, accel, dt)
    }, true);

    const speed = Math.hypot(lv.x, lv.z);
    const turn = steer * (this.type === 'tank' ? 1.15 : 1.9) * (0.35 + clamp(speed / maxSpeed, 0, 1) * 0.65);
    this.body.setAngvel({ x: 0, y: damp(this.body.angvel().y, turn, 6, dt), z: 0 }, true);

    if (deep && isPlayerDriver) this.takeDamage(8 * dt, null, 'water', this.getCenter());
  }

  update(dt) {
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && this.game.roundActive) this.respawn();
    }
    if (!this.body) return;
    const t = this.body.translation();
    const q = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    if (this.destroyed) this.mesh.rotation.z = 0.18;

    this.cannonReload = Math.max(0, this.cannonReload - dt);
    this.mgCooldown = Math.max(0, this.mgCooldown - dt);

    if (this.turretGroup) this.turretGroup.rotation.y = this.turretYaw;
    if (this.barrelGroup) this.barrelGroup.rotation.x = this.turretPitch;
    if (this.mgGroup) {
      this.mgGroup.rotation.y = this.type === 'tank' ? this.turretYaw : this.aimYaw;
      this.mgGroup.rotation.x = this.type === 'tank' ? this.turretPitch * 0.5 : 0;
    }
    if (this.wheels) {
      const speed = this.body.linvel();
      const spin = Math.hypot(speed.x, speed.z) / 0.55;
      for (const w of this.wheels) w.rotation.x += spin * dt;
    }

    if (this.driver && this.driver.isPlayer) {
      this.updateCamera(this.game.camera);
      const input = this.game.input;
      if (this.type === 'tank') {
        if (input.consumeMouse(0)) this.fireCannon();
        if (input.isMouseDown(2)) this.fireMG();
      } else {
        if (input.isMouseDown(0)) this.fireMG();
      }
    }

    const center = this.getCenter();
    this.ensureEngine();
    if (this.engine) {
      const speed = this.body.linvel();
      this.engine.update(Math.hypot(speed.x, speed.z), center);
    }

    if (this.hp < this.maxHp * 0.5 && !this.destroyed) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = this.hp < this.maxHp * 0.22 ? 0.12 : 0.3;
        this.game.effects.smokePuff(center.clone().add(new THREE.Vector3(0, 1, 0)), this.hp < this.maxHp * 0.22 ? 0x5a4a3c : 0x8a8378);
        if (this.hp < this.maxHp * 0.22) {
          this.game.effects.spawnParticles(center.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, 1, 0), 1, 0xff7a2f, 1.8);
        }
      }
    }

    this.roadkillTimer -= dt;
    if (this.roadkillTimer <= 0) {
      this.roadkillTimer = 0.25;
      const speed = Math.hypot(this.body.linvel().x, this.body.linvel().z);
      if (speed > 5) {
        for (const soldier of this.game.getSoldiers()) {
          if (soldier === this.driver || soldier.downed || soldier.dead) continue;
          if (soldier.getCenter().distanceTo(center) < 3.2) {
            soldier.takeDamage(120, this.driver, 'crush', center);
          }
        }
      }
    }

    if (this.driver && this.driver.isPlayer) {
      this.game.ui.hud.setVehicle(this);
    }
  }

  updateCamera(camera) {
    const center = this.getCenter();
    let camYaw;
    let aimDir;
    if (this.type === 'tank') {
      camYaw = this.getYaw() + this.turretYaw;
      const e = new THREE.Euler(this.turretPitch, camYaw, 0, 'YXZ');
      aimDir = new THREE.Vector3(0, 0, -1).applyEuler(e).normalize();
    } else {
      camYaw = this.getYaw() + this.aimYaw;
      aimDir = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    }
    const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const dist = this.type === 'tank' ? 9.5 : 8.5;
    const height = this.type === 'tank' ? 4.8 : 3.8;
    const desired = center.clone().addScaledVector(forward, -dist).add(new THREE.Vector3(0, height, 0));

    const dir = desired.clone().sub(center);
    const len = dir.length();
    dir.normalize();
    const ray = new RAPIER.Ray(center, dir);
    const hit = this.game.physicsWorld.castRay(ray, len, true, undefined, undefined, this.collider);
    let camPos = desired;
    if (hit) camPos = center.clone().addScaledVector(dir, Math.max(2.2, hit.timeOfImpact - 0.6));
    camera.position.copy(camPos);
    camera.position.add(this.game.shakeOffset);
    const look = center.clone().addScaledVector(aimDir, 35).add(new THREE.Vector3(0, this.type === 'tank' ? 2.5 : 1.4, 0));
    camera.lookAt(look);
    camera.fov = this.type === 'tank' ? 62 : 68;
    camera.updateProjectionMatrix();
  }

  fireCannon() {
    if (this.cannonReload > 0 || this.destroyed) return;
    const center = this.getCenter();
    const camYaw = this.getYaw() + this.turretYaw;
    const e = new THREE.Euler(this.turretPitch, camYaw, 0, 'YXZ');
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(e).normalize();
    const muzzle = center.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(dir, 3.2);
    const lv = this.body.linvel();
    this.game.spawnProjectile({
      type: 'shell',
      owner: this,
      team: this.team,
      position: muzzle,
      velocity: dir.clone().multiplyScalar(105).add(new THREE.Vector3(lv.x, lv.y, lv.z)),
      damage: 150,
      splashDamage: 65,
      splashRadius: 4.5
    });
    this.game.alertBots(this, muzzle);
    this.cannonReload = 4.2;
    this.game.audio.playGun('cannon', null, true);
    this.game.effects.muzzleFlash(muzzle, dir, true);
    this.game.addShake(0.45, muzzle);
    this.game.effects.spawnParticles(muzzle, dir, 8, 0xffc070, 3.5);
  }

  fireMG() {
    if (this.mgCooldown > 0 || this.destroyed) return;
    const def = this.type === 'tank'
      ? { damage: 18, headMult: 1.5, range: 95, falloffStart: 25, falloffEnd: 85, minDamage: 0.5, spread: 0.012 }
      : { damage: 22, headMult: 1.5, range: 95, falloffStart: 25, falloffEnd: 85, minDamage: 0.5, spread: 0.016 };
    this.mgCooldown = 60 / (this.type === 'tank' ? 520 : 600);
    const camera = this.game.camera;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const origin = camera.position.clone().addScaledVector(dir, 0.4).addScaledVector(right, -0.15);
    const finalDir = spreadDirection(dir, def.spread);
    const muzzle = origin.clone().addScaledVector(finalDir, 0.4);
    this.game.combat.hitscan(origin, finalDir, def, this, { muzzlePos: muzzle, isPlayer: true });
    this.game.alertBots(this, muzzle);
    this.game.audio.playGun(this.type === 'tank' ? 'tankmg' : 'jeepmg', null, true);
    this.game.effects.muzzleFlash(muzzle, finalDir, true);
  }

  takeDamage(amount, source, part = 'vehicle', point = null) {
    if (this.destroyed) return false;
    let armor = 1;
    if (point && this.body) {
      const center = this.getCenter();
      const dir = point.clone().sub(center).normalize();
      const forward = this.getForward();
      const dot = dir.dot(forward);
      if (dot > 0.45) armor = 0.6;
      else if (dot < -0.45) armor = 1.55;
    }
    this.hp -= amount * armor;
    if (this.hp <= 0) {
      this.hp = 0;
      this.destroy(source);
      return true;
    }
    if (this.hp < this.maxHp * 0.25) this.disabled = true;
    return false;
  }

  repair(amount) {
    if (this.destroyed) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > this.maxHp * 0.25) this.disabled = false;
  }

  destroy(source) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.disabled = true;
    const center = this.getCenter();
    this.game.combat.explode(center, { radius: 7, damage: 90, source, vehicleDamage: 0 });
    this.game.audio.playExplosion(center, 1.5);
    this.game.addShake(1.1, center);
    if (this.driver && this.driver.isPlayer) this.driver.exitVehicle();
    this.body.setEnabled(false);
    this.game.registry.remove(this.collider);
    this.mesh.rotation.z = 0.18;
    this.respawnTimer = GAME.vehicleRespawnDelay;
    if (this.engine) this.engine.update(0, center);
    this.game.onVehicleDestroyed(this, source);
  }

  respawn() {
    this.destroyed = false;
    this.disabled = false;
    this.hp = this.maxHp;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.spawnRot, 0));
    this.body.setEnabled(true);
    this.body.setTranslation({ x: this.spawnPos.x, y: this.spawnPos.y + this.bodyHeight, z: this.spawnPos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.mesh.rotation.set(0, 0, 0);
    this.game.registry.add(this.collider, this, 'vehicle');
    this.turretYaw = 0;
    this.turretPitch = 0;
    this.aimYaw = 0;
    this.respawnTimer = 0;
  }

  dispose() {
    if (this.engine) this.engine.stop();
    if (this.body) {
      this.game.registry.remove(this.collider);
      this.game.physicsWorld.removeRigidBody(this.body);
      this.body = null;
    }
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
