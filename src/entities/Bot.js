import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME } from '../config/game.js';
import { CLASSES } from '../config/classes.js';
import { WEAPONS, GADGETS } from '../config/weapons.js';
import { clamp, damp, wrapAngle } from '../core/MathUtils.js';
import { spreadDirection, Weapon } from '../weapons/Weapon.js';
import { SoldierModel } from './SoldierModel.js';

const degToRad = (d) => (d * Math.PI) / 180;

// AI 士兵：感知、導航、兵種行為、交戰、倒地與復活。
export class Bot {
  constructor(game, team, classId, name, slot) {
    this.game = game;
    this.team = team;
    this.classId = classId;
    this.name = name;
    this.slot = slot;
    this.isBot = true;
    this.isSoldier = true;
    this.isVehicle = false;
    this.health = 100;
    this.maxHealth = 100;
    this.downed = false;
    this.dead = false;
    this.bleedout = 0;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.captures = 0;
    this.yaw = 0;
    this.speed = 0;
    this.aiming = false;
    this.body = null;
    this.collider = null;
    this.headCollider = null;
    this.colliders = [];
    this.controller = null;
    this.model = null;
    this.weapon = new Weapon(game, WEAPONS[CLASSES[classId].primary], this);
    this.weapon.setAds(true);
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.objective = null;
    this.objectiveTimer = 0;
    this.target = null;
    this.targetVisible = false;
    this.lastSeenPos = null;
    this.lastSeenTime = -99;
    this.reactionTimer = 0;
    this.state = 'advance';
    this.desiredDir = new THREE.Vector3();
    this.desiredSpeed = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.burstTimer = 0;
    this.burstPause = 0;
    this.stuckTimer = 0;
    this.lastStuckPos = new THREE.Vector3();
    this.reviveTarget = null;
    this.reviveTimer = 0;
    this.repairTarget = null;
    this.healCooldown = 0;
    this.atCooldown = 0;
    this.mineCooldown = 0;
    this.flareCooldown = 0;
    this.deathTimer = 0;
    this.spawnPos = new THREE.Vector3();
    this.lastDamageSource = null;
    this.controller = game.physicsWorld.createCharacterController(0.02);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.enableSnapToGround(0.5);
    this.controller.setMaxSlopeClimbAngle(degToRad(55));
    this.controller.setMinSlopeSlideAngle(degToRad(35));
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }

  get position() {
    if (this.body) {
      const t = this.body.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    }
    return this.spawnPos.clone();
  }

  getCenter() {
    return this.position;
  }

  getEyePosition() {
    const p = this.position;
    return new THREE.Vector3(p.x, p.y + 0.75, p.z);
  }

  getFeetPosition() {
    const p = this.position;
    return new THREE.Vector3(p.x, p.y - 0.9, p.z);
  }

  createBody(pos) {
    const world = this.game.physicsWorld;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + 0.9, pos.z)
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.35).setFriction(0.0), this.body);
    this.headCollider = world.createCollider(
      RAPIER.ColliderDesc.ball(0.22).setTranslation(0, 0.75, 0).setFriction(0.0),
      this.body
    );
    this.colliders = [this.collider, this.headCollider];
    this.game.registry.add(this.collider, this, 'body');
    this.game.registry.add(this.headCollider, this, 'head');
  }

  removeBody() {
    if (!this.body) return;
    this.game.registry.remove(this.collider);
    this.game.registry.remove(this.headCollider);
    this.game.physicsWorld.removeRigidBody(this.body);
    this.body = null;
    this.collider = null;
    this.headCollider = null;
    this.colliders = [];
  }

  reset(spawnPos) {
    this.removeBody();
    this.spawnPos.copy(spawnPos);
    this.createBody(spawnPos);
    if (!this.model) {
      this.model = new SoldierModel(this.game.assets, this.team, this.classId);
      this.game.scene.add(this.model.root);
    } else {
      this.model.reset();
    }
    this.health = this.maxHealth;
    this.downed = false;
    this.dead = false;
    this.bleedout = 0;
    this.deathTimer = 0;
    this.weapon.reset();
    this.weapon.reserve = 9999;
    this.weapon.setAds(true);
    this.yaw = 0;
    this.speed = 0;
    this.aiming = false;
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.objective = null;
    this.objectiveTimer = 0;
    this.target = null;
    this.targetVisible = false;
    this.lastSeenPos = null;
    this.lastSeenTime = -99;
    this.reactionTimer = 0;
    this.state = 'advance';
    this.desiredDir.set(0, 0, 0);
    this.desiredSpeed = 0;
    this.burstTimer = 0;
    this.burstPause = 0;
    this.stuckTimer = 0;
    this.lastStuckPos.copy(spawnPos);
    this.reviveTarget = null;
    this.reviveTimer = 0;
    this.repairTarget = null;
    this.healCooldown = 0;
    this.atCooldown = 0;
    this.mineCooldown = 0;
    this.flareCooldown = 0;
    this.lastDamageSource = null;
    this.model.root.visible = true;
    this.model.setPosition(this.getFeetPosition(), this.yaw);
  }

  updateVisual(dt) {
    if (this.dead) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0 && this.model) this.model.root.visible = false;
      return;
    }
    if (!this.model) return;
    const feet = this.getFeetPosition();
    this.model.setPosition(feet, this.yaw);
    if (this.downed) {
      this.model.setDowned(true);
      this.model.update(dt, 0, false);
    } else {
      this.model.setDowned(false);
      this.model.update(dt, this.speed, this.aiming);
    }
  }

  updateBleedout(dt) {
    if (!this.downed || this.dead) return;
    this.bleedout -= dt;
    if (this.bleedout <= 0) this.die();
  }

  updateMovement(dt) {
    if (this.dead) return;
    if (this.downed) {
      this.speed = 0;
      return;
    }
    const desired = new THREE.Vector3(this.desiredDir.x, 0, this.desiredDir.z);
    if (desired.lengthSq() > 0.001) desired.normalize();

    const pos = this.position;
    const nav = this.game.world.nav;
    if (desired.lengthSq() > 0.001) {
      const probeX = pos.x + desired.x * 1.6;
      const probeZ = pos.z + desired.z * 1.6;
      if (this.game.world.isDeepWater(probeX, probeZ) || !nav.isWalkableAt(probeX, probeZ)) {
        desired.set(0, 0, 0);
      }
    }

    let speed = this.desiredSpeed;
    if (this.downed) speed = 0;
    const vx = desired.x * speed;
    const vz = desired.z * speed;
    const vy = -0.03;
    const ignore = new Set();
    for (const c of this.colliders) ignore.add(c.handle);
    for (const b of this.game.bots) {
      if (b === this || b.dead) continue;
      for (const c of b.colliders) ignore.add(c.handle);
    }
    if (this.game.player && this.game.player.colliders) {
      for (const c of this.game.player.colliders) ignore.add(c.handle);
    }
    this.controller.computeColliderMovement(
      this.collider,
      { x: vx * dt, y: vy, z: vz * dt },
      undefined,
      undefined,
      (c) => !ignore.has(c.handle)
    );
    const move = this.controller.computedMovement();
    const cur = this.body.translation();
    this.body.setNextKinematicTranslation({ x: cur.x + move.x, y: cur.y + move.y, z: cur.z + move.z });
    this.speed = desired.lengthSq() > 0.001 ? speed : 0;

    if (this.targetVisible && this.target) {
      const toTarget = this.target.getCenter().sub(pos);
      const targetYaw = Math.atan2(-toTarget.x, -toTarget.z);
      this.yaw = wrapAngle(this.yaw + wrapAngle(targetYaw - this.yaw) * Math.min(1, dt * 9));
    } else if (this.speed > 0.1) {
      const targetYaw = Math.atan2(-desired.x, -desired.z);
      this.yaw = wrapAngle(this.yaw + wrapAngle(targetYaw - this.yaw) * Math.min(1, dt * 6));
    }

    this.stuckTimer -= dt;
    if (this.stuckTimer <= 0) {
      this.stuckTimer = 1.4;
      const moved = this.position.distanceTo(this.lastStuckPos);
      this.lastStuckPos.copy(this.position);
      if (moved < 0.45 && this.desiredDir.lengthSq() > 0.1) {
        this.repathTimer = 0;
        this.strafeDir *= -1;
      }
    }
  }

  updateAI(dt) {
    if (this.dead) return;
    if (this.downed) {
      this.weapon.update(dt);
      return;
    }
    this.weapon.update(dt);
    this.healCooldown = Math.max(0, this.healCooldown - dt);
    this.atCooldown = Math.max(0, this.atCooldown - dt);
    this.mineCooldown = Math.max(0, this.mineCooldown - dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    this.reactionTimer -= dt;

    this.perceive();
    this.objectiveTimer -= dt;
    if (this.objectiveTimer <= 0 || !this.objective) {
      this.objectiveTimer = 4 + Math.random() * 3;
      this.chooseObjective();
    }

    this.repathTimer -= dt;

    const c = CLASSES[this.classId];
    const targetDist = this.target ? this.target.getCenter().distanceTo(this.position) : 999;
    const enemyNear = this.targetVisible && targetDist < 22;

    if (this.classId === 'medic') {
      const ally = this.findDownedAlly();
      if (ally && (!enemyNear || targetDist > 26)) {
        this.reviveTarget = ally;
        this.reviveTimer += dt;
        const d = ally.getCenter().distanceTo(this.position);
        this.moveToward(ally.getCenter(), d < 2.2 ? 0 : 4.6);
        if (d < 2.3) {
          if (this.reviveTimer >= 1.5) {
            ally.revive(50);
            this.reviveTimer = 0;
            this.reviveTarget = null;
            this.game.audio.playSpawn();
          }
        }
        this.aiming = false;
        this.state = 'revive';
        return;
      }
      this.reviveTarget = null;
      this.reviveTimer = 0;
      if (this.healCooldown <= 0 && !enemyNear) {
        const ally = this.findHealTarget();
        if (ally) {
          ally.heal(25);
          this.healCooldown = 6;
        }
      }
    }

    if (this.classId === 'engineer') {
      const v = this.findRepairVehicle();
      if (v && !enemyNear) {
        this.repairTarget = v;
        const d = v.getCenter().distanceTo(this.position);
        this.moveToward(v.getCenter(), d < 5 ? 0 : 4.6);
        if (d < 5.2) v.repair(45 * dt);
        this.aiming = false;
        this.state = 'repair';
        return;
      }
      this.repairTarget = null;
      const ev = this.findEnemyVehicle(24);
      if (ev && this.mineCooldown <= 0) {
        const fwd = ev.getForward();
        const p = ev.getCenter().addScaledVector(fwd, 6);
        const y = this.game.world.heightAt(p.x, p.z);
        this.game.spawnProjectile({ type: 'mine', owner: this, team: this.team, position: new THREE.Vector3(p.x, y + 0.1, p.z) });
        this.mineCooldown = 20;
      }
    }

    if (this.classId === 'assault' && this.atCooldown <= 0) {
      const ev = this.findEnemyVehicle(26);
      if (ev && this.hasLOS(ev.getCenter())) {
        this.throwAT(ev);
        this.atCooldown = 15;
      }
    }

    if (this.classId === 'scout' && this.flareCooldown <= 0 && this.objective) {
      const flag = this.game.world.getFlag(this.objective);
      if (flag) {
        const p = flag.pos.clone();
        p.y += 2;
        const dir = p.clone().sub(this.getEyePosition()).normalize();
        this.game.spawnProjectile({
          type: 'flare',
          owner: this,
          team: this.team,
          position: this.getEyePosition().addScaledVector(dir, 0.5),
          velocity: dir.multiplyScalar(18).add(new THREE.Vector3(0, 5, 0))
        });
        this.flareCooldown = 30;
      }
    }

    if (this.targetVisible && this.target) {
      this.state = 'engage';
      this.aiming = true;
      const dist = targetDist;
      const pref = this.classId === 'scout' ? 45 : 18;
      if (dist > pref + 12) {
        this.moveToward(this.target.getCenter(), 4.2);
      } else if (dist < 7) {
        this.strafeDir = this.strafeDir || 1;
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 0.8 + Math.random() * 0.8;
          this.strafeDir *= -1;
        }
        const dir = this.target.getCenter().sub(this.position).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
        this.desiredDir.copy(side);
        this.desiredSpeed = 3.2;
      } else {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 0.7 + Math.random() * 0.9;
          this.strafeDir *= -1;
        }
        const dir = this.target.getCenter().sub(this.position).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir * 0.7);
        this.desiredDir.copy(side);
        this.desiredSpeed = 2.4;
      }

      if (this.health < 32 && dist < 30) {
        const away = this.position.clone().sub(this.target.getCenter()).normalize();
        this.desiredDir.copy(away);
        this.desiredSpeed = 4.8;
        this.state = 'retreat';
      }

      if (this.reactionTimer <= 0) this.fireAt(this.target, dist);
      return;
    }

    this.target = null;
    this.aiming = false;

    if (this.lastSeenPos && this.game.time - this.lastSeenTime < 6) {
      this.state = 'advance';
      this.moveToward(this.lastSeenPos, 4.6);
      return;
    }

    if (this.objective) {
      const flag = this.game.world.getFlag(this.objective);
      if (flag) {
        const dist = flag.pos.distanceTo(this.position);
        if (dist < flag.radius * 0.75) {
          this.state = 'hold';
          this.desiredDir.set(Math.cos(this.game.time * 0.5 + this.slot), 0, Math.sin(this.game.time * 0.5 + this.slot)).multiplyScalar(0.25);
          this.desiredSpeed = 1.2;
          this.strafeTimer -= dt;
          if (this.strafeTimer <= 0) {
            this.strafeTimer = 2 + Math.random() * 2;
            this.strafeDir *= -1;
          }
        } else {
          this.state = 'advance';
          this.moveToward(flag.pos, 4.8);
        }
      }
    }
  }

  moveToward(point, speed) {
    const dir = new THREE.Vector3(point.x - this.position.x, 0, point.z - this.position.z);
    if (dir.lengthSq() < 0.01) {
      this.desiredDir.set(0, 0, 0);
      this.desiredSpeed = 0;
      return;
    }
    dir.normalize();

    if (this.repathTimer <= 0 || !this.path.length) {
      this.repathTimer = 1.6 + Math.random() * 1.2;
      this.path = this.game.world.nav.findPath(this.position, point);
      this.pathIndex = 0;
    }

    if (this.path.length) {
      while (this.pathIndex < this.path.length - 1) {
        const wp = this.path[this.pathIndex];
        if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) < 1.4) this.pathIndex++;
        else break;
      }
      const wp = this.path[Math.min(this.pathIndex, this.path.length - 1)];
      const pdir = new THREE.Vector3(wp.x - this.position.x, 0, wp.z - this.position.z);
      if (pdir.lengthSq() > 0.001) pdir.normalize();
      dir.copy(pdir);
    }

    for (const other of this.game.bots) {
      if (other === this || other.dead || other.downed) continue;
      const d = other.position.distanceTo(this.position);
      if (d < 1.6 && d > 0.01) {
        const push = this.position.clone().sub(other.position).setY(0).normalize();
        dir.addScaledVector(push, (1.6 - d) * 0.8);
      }
    }
    dir.y = 0;
    if (dir.lengthSq() > 0.001) dir.normalize();
    this.desiredDir.copy(dir);
    this.desiredSpeed = speed;
  }

  chooseObjective() {
    const flags = this.game.world.flags;
    const own = flags.filter((f) => f.owner === this.team).length;
    const enemy = flags.filter((f) => f.owner && f.owner !== this.team).length;
    let best = null;
    let bestScore = Infinity;
    for (const f of flags) {
      let score;
      if (f.owner !== this.team) {
        score = f.pos.distanceTo(this.position) - (own < enemy ? 40 : 0);
      } else {
        score = f.pos.distanceTo(this.position) + 60;
      }
      score += Math.random() * 12;
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    this.objective = best ? best.id : null;
  }

  perceive() {
    const enemies = [];
    if (this.game.player && this.game.player.team !== this.team && !this.game.player.downed && !this.game.player.dead && !this.game.player.inVehicle) {
      enemies.push(this.game.player);
    }
    for (const b of this.game.bots) {
      if (b === this || b.team === this.team || b.downed || b.dead) continue;
      enemies.push(b);
    }
    const eye = this.getEyePosition();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const maxRange = GAME.botDifficulty.maxRange;
    let best = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      const targetPos = e.getCenter();
      const dir = targetPos.clone().sub(eye);
      const dist = dir.length();
      if (dist > maxRange) continue;
      dir.normalize();
      const dot = forward.dot(new THREE.Vector3(dir.x, 0, dir.z).normalize());
      if (dist > 16 && dot < Math.cos(GAME.botDifficulty.fov * 0.5)) continue;
      if (this.canSee(e, dist)) {
        if (dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
    }
    if (best) {
      if (this.target !== best) {
        this.target = best;
        this.reactionTimer = GAME.botDifficulty.reactionMin + Math.random() * (GAME.botDifficulty.reactionMax - GAME.botDifficulty.reactionMin);
        this.burstTimer = 0;
        this.burstPause = 0;
      }
      this.targetVisible = true;
      this.lastSeenPos = best.getCenter().clone();
      this.lastSeenTime = this.game.time;
    } else {
      this.targetVisible = false;
    }
  }

  canSee(target, dist) {
    const eye = this.getEyePosition();
    const targetPos = target.getCenter();
    const dir = targetPos.clone().sub(eye);
    const len = dir.length();
    dir.normalize();
    const ray = new RAPIER.Ray(eye, dir);
    const ignore = new Set(this.colliders.map((c) => c.handle));
    const hit = this.game.physicsWorld.castRay(ray, len, true, undefined, undefined, undefined, undefined, (c) => !ignore.has(c.handle));
    if (!hit) return false;
    if (hit.timeOfImpact >= len - 0.5) return true;
    const entry = this.game.registry.get(hit.collider.handle);
    return entry?.entity === target;
  }

  hasLOS(point) {
    const eye = this.getEyePosition();
    const dir = point.clone().sub(eye);
    const len = dir.length();
    dir.normalize();
    const ray = new RAPIER.Ray(eye, dir);
    const ignore = new Set(this.colliders.map((c) => c.handle));
    const hit = this.game.physicsWorld.castRay(ray, len, true, undefined, undefined, undefined, undefined, (c) => !ignore.has(c.handle));
    if (!hit) return true;
    return hit.timeOfImpact >= len - 0.6;
  }

  fireAt(target, dist) {
    const eye = this.getEyePosition();
    const targetPos = target.getCenter().clone();
    targetPos.y += 0.15;
    const baseDir = targetPos.sub(eye).normalize();
    const moving = this.speed > 0.5;
    let err = GAME.botDifficulty.aimError * (1 + dist / 90);
    if (moving) err += GAME.botDifficulty.aimErrorMoving;
    if (this.classId === 'scout') err *= 0.75;
    const dir = spreadDirection(baseDir, err);
    const muzzle = eye.clone().addScaledVector(dir, 0.45);

    const def = this.weapon.def;
    if (def.type === 'auto') {
      if (this.burstPause > 0) {
        this.burstPause -= 0.1;
        return;
      }
      if (this.burstTimer <= 0) {
        this.burstTimer = GAME.botDifficulty.burstMin + Math.random() * (GAME.botDifficulty.burstMax - GAME.botDifficulty.burstMin);
      }
      this.burstTimer -= 0.1;
      this.weapon.tryFire(this.game.time, eye, dir, 0, muzzle);
      if (this.burstTimer <= 0) {
        this.burstPause = GAME.botDifficulty.burstPauseMin + Math.random() * (GAME.botDifficulty.burstPauseMax - GAME.botDifficulty.burstPauseMin);
      }
    } else {
      this.weapon.tryFire(this.game.time, eye, dir, 0, muzzle);
    }
  }

  throwAT(vehicle) {
    const eye = this.getEyePosition();
    const dir = vehicle.getCenter().sub(eye).normalize();
    const pos = eye.clone().addScaledVector(dir, 0.5);
    const velocity = dir.clone().multiplyScalar(16);
    velocity.y += 4;
    this.game.spawnProjectile({ type: 'atGrenade', owner: this, team: this.team, position: pos, velocity });
  }

  findDownedAlly() {
    let best = null;
    let bestD = 12;
    if (this.game.player && this.game.player.team === this.team && this.game.player.downed && !this.game.player.dead) {
      const d = this.game.player.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = this.game.player;
      }
    }
    for (const b of this.game.bots) {
      if (b === this || b.team !== this.team || !b.downed || b.dead) continue;
      const d = b.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  findHealTarget() {
    let best = null;
    let bestD = 8;
    if (this.game.player && this.game.player.team === this.team && !this.game.player.downed && !this.game.player.dead && this.game.player.health < 65) {
      const d = this.game.player.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = this.game.player;
      }
    }
    for (const b of this.game.bots) {
      if (b === this || b.team !== this.team || b.downed || b.dead) continue;
      if (b.health >= 65) continue;
      const d = b.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  findRepairVehicle() {
    let best = null;
    let bestD = 20;
    for (const v of this.game.vehicles) {
      if (v.team !== this.team || v.destroyed || v.hp >= v.maxHp) continue;
      const d = v.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  findEnemyVehicle(range) {
    let best = null;
    let bestD = range;
    for (const v of this.game.vehicles) {
      if (v.team === this.team || v.destroyed) continue;
      const d = v.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  heal(amount) {
    if (this.downed || this.dead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  takeDamage(amount, source, part = 'body', point = null) {
    if (this.downed || this.dead) return false;
    this.health -= amount;
    this.lastDamageSource = source;
    if (this.health <= 0) {
      this.health = 0;
      this.down(source);
      return true;
    }
    return false;
  }

  down(source) {
    if (this.downed || this.dead) return;
    this.downed = true;
    this.bleedout = GAME.bleedoutTime;
    this.health = 0;
    this.lastDamageSource = source;
    this.desiredDir.set(0, 0, 0);
    this.desiredSpeed = 0;
    this.aiming = false;
    if (this.model) this.model.setDowned(true);
    this.game.onDowned(source, this);
  }

  revive(hp = 50) {
    if (this.dead) return;
    this.downed = false;
    this.health = hp;
    this.bleedout = 0;
    if (this.model) {
      this.model.setDowned(false);
      this.model.root.visible = true;
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.downed = false;
    this.desiredDir.set(0, 0, 0);
    this.desiredSpeed = 0;
    this.removeBody();
    if (this.model) this.model.setDead();
    this.deathTimer = 3.5;
    this.game.onBotDeath(this, this.lastDamageSource);
  }

  dispose() {
    this.removeBody();
    if (this.model) this.model.dispose();
    this.model = null;
  }
}
