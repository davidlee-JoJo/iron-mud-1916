import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GADGETS } from '../config/weapons.js';

// 手榴彈、反載具手榴彈、坦克砲彈、地雷與信號彈。
export class Projectile {
  constructor(game, opts) {
    this.game = game;
    this.type = opts.type;
    this.owner = opts.owner || null;
    this.team = opts.team || opts.owner?.team || null;
    this.dead = false;
    this.age = 0;
    this.prevPos = opts.position.clone();
    this.position = opts.position.clone();
    this.mesh = null;
    this.body = null;
    this.collider = null;
    this.light = null;
    this.spotTimer = 0;
    this.stuck = false;
    this.build(opts);
  }

  build(opts) {
    const a = this.game.assets;
    if (this.type === 'grenade' || this.type === 'atGrenade') {
      const r = this.type === 'atGrenade' ? 0.16 : 0.12;
      const geo = new THREE.SphereGeometry(r, 10, 8);
      this.mesh = new THREE.Mesh(geo, this.type === 'atGrenade' ? a.materials.metalDark : a.materials.metal);
      this.mesh.castShadow = true;
      this.game.scene.add(this.mesh);
      this.body = this.game.physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(this.position.x, this.position.y, this.position.z)
          .setLinvel(opts.velocity.x, opts.velocity.y, opts.velocity.z)
          .setLinearDamping(0.15)
          .setAngularDamping(0.4)
          .setCcdEnabled(true)
      );
      this.collider = this.game.physicsWorld.createCollider(
        RAPIER.ColliderDesc.ball(r).setMass(0.6).setFriction(0.8).setRestitution(0.35),
        this.body
      );
      const g = GADGETS[this.type];
      this.fuse = g.fuse;
      this.damage = g.damage;
      this.radius = g.radius;
      this.vehicleDamage = g.vehicleDamage || 0;
    } else if (this.type === 'shell') {
      const geo = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 8);
      this.mesh = new THREE.Mesh(geo, a.materials.metalDark);
      this.mesh.castShadow = true;
      const v = opts.velocity.clone().normalize();
      this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      this.game.scene.add(this.mesh);
      this.body = this.game.physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(this.position.x, this.position.y, this.position.z)
          .setLinvel(opts.velocity.x, opts.velocity.y, opts.velocity.z)
          .setLinearDamping(0.02)
          .setCcdEnabled(true)
      );
      this.collider = this.game.physicsWorld.createCollider(
        RAPIER.ColliderDesc.ball(0.12).setMass(12).setRestitution(0.05),
        this.body
      );
      this.damage = opts.damage ?? 150;
      this.splashDamage = opts.splashDamage ?? 65;
      this.radius = opts.splashRadius ?? 4.5;
      this.vehicleDamage = opts.damage ?? 150;
      this.life = 7;
    } else if (this.type === 'mine') {
      const geo = new THREE.CylinderGeometry(0.28, 0.32, 0.12, 12);
      this.mesh = new THREE.Mesh(geo, a.materials.metalDark);
      this.mesh.castShadow = true;
      this.mesh.position.copy(this.position);
      this.mesh.position.y += 0.07;
      this.game.scene.add(this.mesh);
      this.triggerTimer = 0;
      this.damage = GADGETS.mine.damage;
      this.radius = GADGETS.mine.radius;
      this.vehicleDamage = GADGETS.mine.vehicleDamage;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), a.materials.fire);
      cap.position.y = 0.12;
      this.mesh.add(cap);
    } else if (this.type === 'flare') {
      const geo = new THREE.CylinderGeometry(0.06, 0.08, 0.28, 8);
      this.mesh = new THREE.Mesh(geo, a.materials.metalDark);
      this.game.scene.add(this.mesh);
      this.body = this.game.physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(this.position.x, this.position.y, this.position.z)
          .setLinvel(opts.velocity.x, opts.velocity.y, opts.velocity.z)
          .setLinearDamping(0.1)
          .setAngularDamping(0.5)
          .setCcdEnabled(true)
      );
      this.collider = this.game.physicsWorld.createCollider(
        RAPIER.ColliderDesc.ball(0.1).setMass(0.4).setRestitution(0.15),
        this.body
      );
      this.life = GADGETS.flare.life;
      this.radius = GADGETS.flare.radius;
      this.light = new THREE.PointLight(0xff4a2f, 22, 32, 2);
      this.game.scene.add(this.light);
    }
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;

    if (this.type === 'mine') {
      this.triggerTimer -= dt;
      if (this.triggerTimer <= 0) {
        this.triggerTimer = 0.2;
        const center = this.mesh.position.clone();
        for (const v of this.game.vehicles) {
          if (v.destroyed || v.team === this.team) continue;
          if (v.getCenter().distanceTo(center) < 3.2) {
            this.explode(center);
            return;
          }
        }
        for (const s of this.game.getSoldiers()) {
          if (s.team === this.team || s.downed || s.dead) continue;
          if (s.getCenter().distanceTo(center) < 2.0) {
            this.explode(center);
            return;
          }
        }
      }
      return;
    }

    if (this.body) {
      const t = this.body.translation();
      this.position.set(t.x, t.y, t.z);
      if (this.mesh) {
        this.mesh.position.copy(this.position);
        if (this.type !== 'shell') {
          const q = this.body.rotation();
          this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
        }
      }
    }

    if (this.type === 'grenade' || this.type === 'atGrenade') {
      this.fuse -= dt;
      if (this.fuse <= 0) this.explode(this.position);
      return;
    }

    if (this.type === 'shell') {
      this.life -= dt;
      const current = this.position;
      const dir = current.clone().sub(this.prevPos);
      const dist = dir.length();
      if (dist > 0.01) {
        dir.normalize();
        const ignore = new Set(this.owner?.colliders?.map((c) => c.handle) || []);
        ignore.add(this.collider.handle);
        const ray = new RAPIER.Ray(this.prevPos, dir);
        const hit = this.game.physicsWorld.castRayAndGetNormal(
          ray, dist + 0.8, true, undefined, undefined, undefined, undefined,
          (c) => !ignore.has(c.handle)
        );
        if (hit) {
          const point = this.prevPos.clone().addScaledVector(dir, hit.timeOfImpact);
          const entry = this.game.registry.get(hit.collider.handle);
          if (entry?.entity) {
            entry.entity.takeDamage(this.damage, this.owner, entry.part, point);
          }
          this.explode(point);
          return;
        }
      }
      this.prevPos.copy(current);
      if (this.life <= 0) this.explode(this.position);
      return;
    }

    if (this.type === 'flare') {
      if (!this.stuck) {
        const speed = this.body.linvel();
        const ground = this.game.world.heightAt(this.position.x, this.position.z);
        const grounded = this.position.y < ground + 0.7;
        if (this.age > 0.9 && (Math.hypot(speed.x, speed.y, speed.z) < 1.6 || grounded)) {
          this.stuck = true;
          this.body.setGravityScale(0, true);
          this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          this.position.y = ground + 0.2;
          this.body.setTranslation({ x: this.position.x, y: this.position.y, z: this.position.z }, true);
        }
      }
      if (this.light) {
        this.light.position.copy(this.position).add(new THREE.Vector3(0, 0.6, 0));
        this.light.intensity = 20 + Math.sin(this.age * 9) * 4;
      }
      if (this.stuck) {
        this.spotTimer -= dt;
        if (this.spotTimer <= 0) {
          this.spotTimer = 0.5;
          this.game.spotEnemies(this.team, this.position, this.radius, 2.5);
          this.game.effects.smokePuff(this.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x9a4030, 1.2);
        }
      }
      this.life -= dt;
      if (this.life <= 0) this.remove();
    }
  }

  explode(position) {
    if (this.dead) return;
    const opts = {
      radius: this.radius,
      damage: this.type === 'shell' ? this.splashDamage : this.damage,
      source: this.owner,
      vehicleDamage: this.vehicleDamage
    };
    this.game.combat.explode(position, opts);
    this.remove();
  }

  remove() {
    if (this.dead) return;
    this.dead = true;
    if (this.body) {
      this.game.physicsWorld.removeRigidBody(this.body);
      this.body = null;
    }
    if (this.mesh) {
      this.game.scene.remove(this.mesh);
      this.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      this.mesh = null;
    }
    if (this.light) {
      this.game.scene.remove(this.light);
      this.light = null;
    }
  }
}
