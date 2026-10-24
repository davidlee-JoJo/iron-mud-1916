import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME } from '../config/game.js';
import { CLASSES } from '../config/classes.js';
import { WEAPONS, GADGETS } from '../config/weapons.js';
import { clamp, damp } from '../core/MathUtils.js';
import { Weapon } from '../weapons/Weapon.js';
import { Viewmodel } from '../weapons/Viewmodel.js';

const degToRad = (d) => (d * Math.PI) / 180;

// 玩家：Rapier 角色控制器、四兵種、武器、技能、載具進出與倒地復活。
export class Player {
  constructor(game) {
    this.game = game;
    this.isPlayer = true;
    this.isSoldier = true;
    this.isVehicle = false;
    this.team = GAME.playerTeam;
    this.name = '玩家';
    this.classId = 'assault';
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
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.adsT = 0;
    this.wantAds = false;
    this.sprint = false;
    this.crouch = false;
    this.moveSpeed = 0;
    this.bobTime = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpQueued = false;
    this.weapons = [];
    this.weaponIndex = 0;
    this.grenadeCount = 2;
    this.abilityCount = 1;
    this.abilityCooldown = 0;
    this.reviveTarget = null;
    this.reviveProgress = 0;
    this.repairTarget = null;
    this.damageFlash = 0;
    this.stepTimer = 0;
    this.inVehicle = null;
    this.body = null;
    this.collider = null;
    this.headCollider = null;
    this.colliders = [];
    this.controller = null;
    this.viewmodel = null;
    this.spawnPos = new THREE.Vector3();
    this.promptText = null;
    this.lastDamageSource = null;
    this.swimTime = 0;
  }

  get weapon() {
    return this.weapons[this.weaponIndex] || null;
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
    return new THREE.Vector3(p.x, p.y + (this.crouch ? 0.45 : 0.75), p.z);
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

    this.controller = world.createCharacterController(0.02);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.enableSnapToGround(0.5);
    this.controller.setMaxSlopeClimbAngle(degToRad(62));
    this.controller.setMinSlopeSlideAngle(degToRad(45));
    this.controller.setApplyImpulsesToDynamicBodies(true);
  }

  spawn(classId, pos) {
    if (!this.body) this.createBody(pos);
    this.spawnPos.copy(pos);
    this.body.setEnabled(true);
    this.body.setTranslation({ x: pos.x, y: pos.y + 0.9, z: pos.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.health = this.maxHealth;
    this.downed = false;
    this.dead = false;
    this.bleedout = 0;
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.adsT = 0;
    this.inVehicle = null;
    this.reviveTarget = null;
    this.reviveProgress = 0;
    this.damageFlash = 0;
    this.stepTimer = 0;
    if (!this.viewmodel) {
      this.viewmodel = new Viewmodel(this.game);
      this.viewmodel.resize(window.innerWidth, window.innerHeight);
    }
    this.setClass(classId);
    this.viewmodel.setHidden(false);
    this.game.ui.hud.setScope(false);
    this.game.ui.hud.hideDowned();
    this.game.audio.playSpawn();
  }

  setClass(classId) {
    this.classId = classId;
    const c = CLASSES[classId] || CLASSES.assault;
    this.weapons = [
      new Weapon(this.game, WEAPONS[c.primary], this),
      new Weapon(this.game, WEAPONS[c.secondary], this)
    ];
    this.weaponIndex = 0;
    this.grenadeCount = c.grenades;
    this.abilityCount = c.abilityCount;
    this.abilityCooldown = 0;
    if (this.viewmodel) this.viewmodel.setClass(classId, WEAPONS[c.primary].viewmodel);
  }

  updateLook(dt) {
    if (this.inVehicle) return;
    const input = this.game.input;
    const settings = this.game.settings;
    const mouse = input.consumeMouseDelta();
    const scopeZoom = this.weapon?.def.scope && this.adsT > 0.85;
    const sens = settings.sensitivity * (this.adsT > 0.5 ? 0.62 : 1) * (scopeZoom ? 0.4 : 1);
    this.yaw -= mouse.x * sens;
    this.pitch -= mouse.y * sens * (settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
    if (this.viewmodel) this.viewmodel.setSway(mouse.x, mouse.y);

    const def = this.weapon?.def;
    const recover = def ? def.recoilRecover : 7;
    this.recoilPitch = damp(this.recoilPitch, 0, recover, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, recover, dt);

    this.wantAds = input.isMouseDown(2) && !this.sprint && !this.downed;
    const target = this.wantAds ? 1 : 0;
    const speed = def ? 1 / Math.max(0.05, def.adsTime) : 6;
    this.adsT = damp(this.adsT, target, speed * 2.5, dt);
    if (this.weapon) this.weapon.setAds(this.adsT > 0.5);

    const baseFov = this.game.settings.fov;
    const targetFov = this.adsT > 0.5 && def ? def.adsFov : baseFov;
    this.game.camera.fov = damp(this.game.camera.fov, targetFov, 10, dt);
    this.game.camera.updateProjectionMatrix();

    const scope = !!(def?.scope && this.adsT > 0.85);
    this.game.ui.hud.setScope(scope);
    if (this.viewmodel) {
      this.viewmodel.setHidden(scope);
      this.viewmodel.update(dt, this);
    }
  }

  updateActions(dt) {
    const input = this.game.input;
    if (this.dead) return;
    if (this.downed) {
      this.bleedout -= dt;
      this.game.ui.hud.setDownedTimer(this.bleedout);
      if (this.bleedout <= 0) this.die();
      return;
    }
    if (this.inVehicle) {
      this.inVehicle.updateLook(dt);
      if (input.consumeKey('KeyE')) this.exitVehicle();
      this.game.ui.hud.setPrompt('E 離開載具');
      return;
    }

    for (const w of this.weapons) w.update(dt);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    this.sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.crouch = input.isDown('ControlLeft') || input.isDown('ControlRight');
    if (this.crouch) this.sprint = false;

    if (input.consumeKey('Digit1')) this.switchWeapon(0);
    if (input.consumeKey('Digit2')) this.switchWeapon(1);
    if (input.consumeKey('KeyR')) this.weapon?.startReload();
    if (input.consumeKey('Space')) this.jumpQueued = true;
    if (input.consumeKey('KeyG')) this.useGrenade();
    if (input.consumeKey('KeyF')) this.useAbility();

    const def = this.weapon?.def;
    if (def) {
      if (def.type === 'auto') {
        if (input.isMouseDown(0)) this.fire();
      } else if (input.consumeMouse(0)) {
        this.fire();
      }
    }

    this.updateInteract(dt);
    this.updatePrompt();
  }

  fire() {
    if (this.downed || this.inVehicle) return;
    const w = this.weapon;
    if (!w) return;
    const camera = this.game.camera;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const origin = camera.position.clone();
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const muzzle = origin.clone().addScaledVector(dir, 0.55).addScaledVector(right, 0.16);
    muzzle.y -= 0.1;
    if (w.tryFire(this.game.time, origin, dir, 0, muzzle)) {
      const d = w.def;
      this.recoilPitch += degToRad(d.recoilPitch) * (this.adsT > 0.5 ? 0.75 : 1);
      this.recoilYaw += degToRad(d.recoilYaw) * (Math.random() < 0.5 ? -1 : 1);
      if (this.viewmodel) this.viewmodel.fireKick();
    }
  }

  switchWeapon(index) {
    if (index === this.weaponIndex || !this.weapons[index]) return;
    this.weaponIndex = index;
    if (this.viewmodel) this.viewmodel.setWeapon(this.weapon.def.viewmodel);
    this.game.audio.playUIClick();
  }

  useGrenade() {
    const c = CLASSES[this.classId];
    if (this.grenadeCount <= 0) return;
    if (c.grenade === 'mine') {
      const dir = this.game.camera.getWorldDirection(new THREE.Vector3());
      const origin = this.game.camera.position.clone();
      const hit = this.game.combat.raycast(origin, dir, 4, new Set(this.colliders.map((x) => x.handle)));
      if (!hit) return;
      this.game.spawnProjectile({ type: 'mine', owner: this, team: this.team, position: hit.point });
      this.grenadeCount--;
    } else {
      this.throwProjectile(c.grenade);
      this.grenadeCount--;
    }
    this.game.audio.playUIClick();
  }

  useAbility() {
    if (this.abilityCooldown > 0) return;
    const c = CLASSES[this.classId];
    if (c.ability === 'repair') {
      const v = this.findRepairTarget();
      if (!v) return;
      v.repair(30);
      this.abilityCooldown = 0.25;
      return;
    }
    if (this.abilityCount <= 0) return;
    if (c.ability === 'atGrenade') {
      this.throwProjectile('atGrenade');
    } else if (c.ability === 'medkit') {
      const pos = this.position.clone();
      pos.y = this.game.world.heightAt(pos.x, pos.z) + 0.1;
      this.game.spawnPickup('medkit', pos, this.team);
    } else if (c.ability === 'flare') {
      this.throwProjectile('flare');
    }
    this.abilityCount--;
    this.abilityCooldown = 0.6;
    this.game.audio.playUIClick();
  }

  throwProjectile(type) {
    const camera = this.game.camera;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const pos = camera.position.clone().addScaledVector(dir, 0.7);
    const velocity = dir.clone().multiplyScalar(type === 'flare' ? 20 : 17);
    velocity.y += type === 'flare' ? 4 : 2.5;
    this.game.spawnProjectile({
      type,
      owner: this,
      team: this.team,
      position: pos,
      velocity
    });
  }

  updateInteract(dt) {
    const input = this.game.input;
    const eDown = input.isDown('KeyE');
    const fDown = input.isDown('KeyF');

    const ally = this.findDownedAlly();
    if (this.classId === 'medic' && ally && eDown) {
      this.reviveTarget = ally;
      this.reviveProgress += dt / GAME.reviveTime;
      if (this.reviveProgress >= 1) {
        ally.revive(50);
        this.reviveProgress = 0;
        this.reviveTarget = null;
        this.game.audio.playSpawn();
      }
    } else {
      this.reviveProgress = 0;
      this.reviveTarget = null;
    }

    if (this.classId === 'engineer' && fDown) {
      const v = this.findRepairTarget();
      if (v) {
        v.repair(55 * dt);
        this.repairTarget = v;
      } else {
        this.repairTarget = null;
      }
    } else {
      this.repairTarget = null;
    }

    if (input.consumeKey('KeyE') && !ally) {
      const v = this.findNearbyVehicle();
      if (v && v.team === this.team && !v.destroyed) this.enterVehicle(v);
    }
  }

  updatePrompt() {
    if (this.reviveTarget) {
      this.game.ui.hud.setPrompt(`復活隊友 ${Math.floor(this.reviveProgress * 100)}%`);
      return;
    }
    const v = this.findNearbyVehicle();
    if (v) {
      if (v.team !== this.team) {
        this.game.ui.hud.setPrompt('敵方載具');
      } else if (v.destroyed) {
        this.game.ui.hud.setPrompt('載具已摧毀');
      } else {
        this.game.ui.hud.setPrompt('E 進入載具');
      }
      return;
    }
    const ally = this.findDownedAlly();
    if (ally && this.classId === 'medic') {
      this.game.ui.hud.setPrompt('按住 E 復活隊友');
      return;
    }
    if (this.classId === 'engineer' && this.findRepairTarget()) {
      this.game.ui.hud.setPrompt('按住 F 維修載具');
      return;
    }
    this.game.ui.hud.setPrompt(null);
  }

  findNearbyVehicle() {
    let best = null;
    let bestD = 5;
    for (const v of this.game.vehicles) {
      const d = v.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  findRepairTarget() {
    let best = null;
    let bestD = 6;
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

  findDownedAlly() {
    let best = null;
    let bestD = 2.8;
    for (const b of this.game.bots) {
      if (!b.downed || b.dead || b.team !== this.team) continue;
      const d = b.getCenter().distanceTo(this.position);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  enterVehicle(v) {
    if (!v.enter(this)) return;
    this.inVehicle = v;
    this.body.setEnabled(false);
    this.adsT = 0;
    this.game.ui.hud.setScope(false);
    if (this.viewmodel) this.viewmodel.setHidden(true);
    this.game.ui.hud.setVehicle(v);
  }

  exitVehicle() {
    const v = this.inVehicle;
    if (!v) return;
    const exit = v.getExitPosition();
    v.exit(this);
    this.inVehicle = null;
    this.body.setEnabled(true);
    this.body.setTranslation({ x: exit.x, y: exit.y + 0.9, z: exit.z }, true);
    this.velocityY = 0;
    this.adsT = 0;
    this.game.ui.hud.setScope(false);
    if (this.viewmodel) this.viewmodel.setHidden(false);
    this.game.ui.hud.setVehicle(null);
  }

  updateMovement(dt) {
    if (this.inVehicle || this.downed || this.dead) return;
    const input = this.game.input;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW')) mz += 1;
    if (input.isDown('KeyS')) mz -= 1;
    if (input.isDown('KeyD')) mx += 1;
    if (input.isDown('KeyA')) mx -= 1;
    const move = new THREE.Vector3().addScaledVector(forward, mz).addScaledVector(right, mx);
    const moving = move.lengthSq() > 0;
    if (moving) move.normalize();

    const pos = this.position;
    const feetY = pos.y - 0.9;
    const deep = this.game.world.isDeepWater(pos.x, pos.z);
    let speed = this.sprint ? 7.2 : this.crouch ? 2.6 : 4.6;
    if (this.adsT > 0.5) speed = Math.min(speed, 2.9);
    if (deep) speed = 2.2;

    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (this.grounded && !deep && !this.crouch) this.velocityY = 7.6;
    }

    if (deep) {
      this.velocityY = 0;
      this.swimTime += dt;
      this.health -= 6.5 * dt;
      this.damageFlash = Math.max(this.damageFlash, 0.35);
      if (this.health <= 0) this.down(null);
    } else {
      this.swimTime = 0;
      this.velocityY += GAME.gravity * dt;
    }

    if (!deep && pos.y < this.game.world.heightAt(pos.x, pos.z) + 0.65) {
      this.body.setTranslation({
        x: pos.x,
        y: this.game.world.heightAt(pos.x, pos.z) + 0.9,
        z: pos.z
      }, true);
      this.velocityY = 0;
    }

    const desired = {
      x: move.x * speed * dt,
      y: deep ? 0 : this.velocityY * dt,
      z: move.z * speed * dt
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const computed = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocityY < 0) this.velocityY = 0;

    const cur = this.body.translation();
    let nextY = cur.y + computed.y;
    if (deep) {
      nextY = damp(cur.y, this.game.world.waterLevel + 0.35, 3.5, dt);
    }
    this.body.setNextKinematicTranslation({
      x: cur.x + computed.x,
      y: nextY,
      z: cur.z + computed.z
    });

    this.moveSpeed = moving ? speed : 0;
    this.bobTime += this.moveSpeed * dt;
    if (moving && this.grounded) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprint ? 0.36 : 0.55;
        this.game.audio.playFootstep(this.game.world.surfaceAt(pos.x, pos.z), null);
      }
    }
  }

  updateCamera(dt) {
    if (this.inVehicle) return;
    const camera = this.game.camera;
    const pos = this.position;
    const eye = this.downed ? 0.25 : this.crouch ? 0.45 : 0.75;
    const bob = this.grounded && this.moveSpeed > 0.5 ? Math.sin(this.bobTime * 2.2) * 0.025 : 0;
    camera.position.set(pos.x, pos.y + eye + bob, pos.z);
    camera.position.add(this.game.shakeOffset);
    camera.rotation.set(
      this.pitch + this.recoilPitch + this.game.shakeRot.x,
      this.yaw + this.recoilYaw + this.game.shakeRot.y,
      0,
      'YXZ'
    );
  }

  takeDamage(amount, source, part = 'body', point = null) {
    if (this.downed || this.dead) return false;
    this.health -= amount;
    this.damageFlash = Math.min(1, this.damageFlash + 0.65);
    this.lastDamageSource = source;
    this.game.audio.playHit(false);
    if (this.health <= 0) {
      this.health = 0;
      this.down(source);
      return true;
    }
    return false;
  }

  down(source) {
    if (this.downed) return;
    this.downed = true;
    this.health = 0;
    this.bleedout = GAME.bleedoutTime;
    this.lastDamageSource = source;
    if (this.inVehicle) this.exitVehicle();
    if (this.viewmodel) this.viewmodel.setHidden(true);
    this.game.ui.hud.setScope(false);
    this.game.ui.hud.showDowned();
    this.game.onDowned(source, this);
  }

  heal(amount) {
    if (this.downed || this.dead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  revive(hp = 50) {
    if (this.dead) return;
    this.downed = false;
    this.health = hp;
    this.bleedout = 0;
    this.damageFlash = 0;
    if (this.viewmodel) this.viewmodel.setHidden(false);
    this.game.ui.hud.hideDowned();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.downed = true;
    this.game.onPlayerDeath(this, this.lastDamageSource);
    if (this.body) this.body.setEnabled(false);
    if (this.viewmodel) this.viewmodel.setHidden(true);
    this.game.ui.hud.hideDowned();
  }

  resupply() {
    for (const w of this.weapons) w.resupply();
    const c = CLASSES[this.classId];
    this.grenadeCount = c.grenades;
    this.abilityCount = c.abilityCount;
  }

  destroyPhysics() {
    if (this.controller) {
      this.controller.free();
      this.controller = null;
    }
    if (this.body) {
      this.game.registry.remove(this.collider);
      this.game.registry.remove(this.headCollider);
      this.game.physicsWorld.removeRigidBody(this.body);
      this.body = null;
    }
    this.collider = null;
    this.headCollider = null;
    this.colliders = [];
  }

  update(dt) {
    if (this.dead) return;
    this.updateLook(dt);
    this.updateCamera(dt);
    this.updateActions(dt);
  }
}
