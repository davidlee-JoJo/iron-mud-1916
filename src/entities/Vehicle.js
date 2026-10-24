import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME } from '../config/game.js';
import { clamp, damp, wrapAngle } from '../core/MathUtils.js';
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
    this.targetYaw = this.spawnRot;
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
    this.hopCooldown = 0;
    this.lastHullYaw = null;
    this.visualPitch = 0;
    this.visualRoll = 0;
    this.engine = null;
    this.mesh = new THREE.Group();
    this.mesh.rotation.order = 'YXZ';
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
      RAPIER.ColliderDesc.cuboid(opts.half.x, opts.half.y, opts.half.z).setMass(opts.mass).setFriction(opts.friction ?? 0.8).setRestitution(0.05),
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
    this.targetYaw = this.getYaw();
    // 上車時砲塔/機槍對齊車體正面。
    this.turretYaw = 0;
    this.turretPitch = 0;
    this.aimYaw = 0;
    this.lastHullYaw = this.getYaw();
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
      // 砲塔可 360 度自由旋轉，與車體行駛方向完全獨立。
      this.turretYaw = wrapAngle(this.turretYaw - mouse.x * sens);
      this.turretPitch -= mouse.y * sens * 0.7;
      this.turretPitch = clamp(this.turretPitch, -0.12, 0.32);
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
    const center = this.getCenter();
    const speedMul = this.disabled ? 0.55 : 1;
    const deep = this.game.world.isDeepWater(center.x, center.z);
    let maxSpeed = (this.type === 'tank' ? 10 : 16) * speedMul * (deep ? 0.35 : 1);
    let accel = this.type === 'tank' ? 5.0 : 7.5;
    const lv = this.body.linvel();

    // 坦克爬坡輔助：取車頭/車尾取樣點高度差估算坡度。
    // 上坡時提高推力並讓車體帶有沿坡面的垂直速度；下坡時輕微下壓貼地。
    let climbY = null;
    if (this.type === 'tank' && throttle !== 0 && !deep) {
      const dirSign = throttle > 0 ? 1 : -1;
      const probe = 2.6;
      const front = this.game.world.heightAt(center.x + forward.x * probe * dirSign, center.z + forward.z * probe * dirSign);
      const back = this.game.world.heightAt(center.x - forward.x * probe * dirSign, center.z - forward.z * probe * dirSign);
      const slope = (front - back) / (2 * probe);
      if (Math.abs(slope) > 0.08) {
        const s = clamp(slope, -1.4, 1.4);
        accel += Math.abs(s) * 3.0;
        const forwardSpeed = Math.abs(lv.x * forward.x + lv.z * forward.z);
        const followY = clamp(s * Math.max(forwardSpeed, 2.0) * 0.9, -6, 6);
        climbY = s > 0 ? Math.max(lv.y, followY) : Math.min(lv.y, followY);
      }
    }
    const desired = throttle * maxSpeed;
    this.body.setLinvel({
      x: damp(lv.x, forward.x * desired, accel, dt),
      y: climbY === null ? lv.y : climbY,
      z: damp(lv.z, forward.z * desired, accel, dt)
    }, true);

    const speed = Math.hypot(lv.x, lv.z);
    const speedFactor = clamp(speed / maxSpeed, 0, 1);

    // 坦克：車身 WASD 與砲塔滑鼠完全獨立，W/S 沿車體前後、A/D 旋轉車體。
    // 吉普：維持原本手感，按 W/S 時車體慢慢對齊機槍/鏡頭方向。
    if (this.type !== 'tank' && throttle !== 0 && steer === 0) {
      if (Math.abs(this.aimYaw) > 0.01) {
        const alignRate = 3.0 * dt;
        const delta = clamp(this.aimYaw, -alignRate, alignRate);
        this.targetYaw = wrapAngle(this.targetYaw + delta);
        this.aimYaw = wrapAngle(this.aimYaw - delta);
      }
    }

    // 目標航向由 A/D 控制；車體會主動修正偏航，避免碰撞或地形讓坦克歪掉。
    const turnRate = (this.type === 'tank' ? 2.4 : 3.4) * (0.65 + speedFactor * 0.35);
    if (steer !== 0) this.targetYaw = wrapAngle(this.targetYaw + steer * turnRate * dt);
    const yawError = wrapAngle(this.targetYaw - this.getYaw());
    const desiredAngVel = clamp(yawError * 5, -4, 4);
    const angvel = this.body.angvel();
    this.body.setAngvel({ x: 0, y: damp(angvel.y, desiredAngVel, 12, dt), z: 0 }, true);

    // 履帶碾壓輔助：前方近距離有低矮障礙（沙包、彈坑緣、戰壕階梯）時
    // 給予向上速度把車體抬過去；障礙太高（牆、建築）則不動作。
    if (this.type === 'tank' && throttle !== 0 && !deep) {
      this.hopCooldown -= dt;
      if (this.hopCooldown <= 0) {
        const dirSign = throttle > 0 ? 1 : -1;
        const bottom = center.y - this.half.y;
        const ox = center.x + forward.x * (this.half.z + 0.2) * dirSign;
        const oz = center.z + forward.z * (this.half.z + 0.2) * dirSign;
        const ray = new RAPIER.Ray(
          { x: ox, y: bottom + 0.25, z: oz },
          { x: forward.x * dirSign, y: 0, z: forward.z * dirSign }
        );
        const hit = this.game.physicsWorld.castRay(ray, 1.8, true, undefined, undefined, this.collider);
        if (hit) {
          const hx = ox + forward.x * dirSign * hit.timeOfImpact;
          const hz = oz + forward.z * dirSign * hit.timeOfImpact;
          const downRay = new RAPIER.Ray({ x: hx, y: bottom + 2.8, z: hz }, { x: 0, y: -1, z: 0 });
          const downHit = this.game.physicsWorld.castRay(downRay, 3.4, true, undefined, undefined, this.collider);
          if (downHit) {
            const stepH = 2.8 - downHit.timeOfImpact;
            if (stepH > 0.05 && stepH < 1.9) {
              const hop = clamp(1.0 + stepH * 1.3, 1.0, 3.4);
              const cur = this.body.linvel();
              this.body.setLinvel({ x: cur.x, y: Math.max(cur.y, hop), z: cur.z }, true);
              this.hopCooldown = 0.35;
            }
          }
        }
      }
    }

    if (deep && isPlayerDriver) this.takeDamage(8 * dt, null, 'water', center);
  }

  // 視覺車體貼地：以前後/左右地形高度差估算俯仰與側傾，平滑套用到外觀。
  // 坦克專用；砲塔群反向補償保持水平，使瞄準視覺與砲彈射向一致。
  applySlopeTilt(dt) {
    let targetPitch = 0;
    let targetRoll = 0;
    if (!this.destroyed && this.type === 'tank' && this.game.world) {
      const t = this.body.translation();
      const fwd = this.getForward();
      const right = this.getRight();
      const dF = 2.4;
      const hFront = this.game.world.heightAt(t.x + fwd.x * dF, t.z + fwd.z * dF);
      const hBack = this.game.world.heightAt(t.x - fwd.x * dF, t.z - fwd.z * dF);
      const hRight = this.game.world.heightAt(t.x + right.x * 1.6, t.z + right.z * 1.6);
      const hLeft = this.game.world.heightAt(t.x - right.x * 1.6, t.z - right.z * 1.6);
      targetPitch = clamp(Math.atan2(hFront - hBack, 2 * dF), -0.3, 0.3);
      targetRoll = clamp(Math.atan2(hRight - hLeft, 3.2), -0.25, 0.25);
    }
    this.visualPitch = damp(this.visualPitch, targetPitch, 4.5, dt);
    this.visualRoll = damp(this.visualRoll, targetRoll, 4.5, dt);
    this.mesh.rotation.x = this.visualPitch;
    this.mesh.rotation.z = this.destroyed ? 0.18 : this.visualRoll;
    if (this.turretGroup) this.turretGroup.rotation.x = -this.visualPitch;
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

    // 坦克砲塔維持世界方向：車體轉動（A/D 或碰撞修正）時反向補償相對角，
    // 讓滑鼠瞄準的方位不會跟著車體一起轉。
    if (!this.destroyed) {
      const yaw = this.getYaw();
      if (this.type === 'tank' && this.lastHullYaw !== null) {
        const dYaw = wrapAngle(yaw - this.lastHullYaw);
        if (dYaw !== 0) this.turretYaw = wrapAngle(this.turretYaw - dYaw);
      }
      this.lastHullYaw = yaw;
    }

    // 視覺上讓車體貼合地形坡度（俯仰/側傾），砲塔群反向補償保持水平，
    // 純外觀不影響物理；砲彈射向仍以 yaw + turretPitch 計算。
    this.applySlopeTilt(dt);

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
    this.targetYaw = this.spawnRot;
    this.turretYaw = 0;
    this.turretPitch = 0;
    this.aimYaw = 0;
    this.lastHullYaw = this.getYaw();
    this.visualPitch = 0;
    this.visualRoll = 0;
    this.hopCooldown = 0;
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
