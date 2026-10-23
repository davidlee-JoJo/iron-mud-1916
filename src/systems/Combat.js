import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { clamp, lerp } from '../core/MathUtils.js';

// 命中判定、傷害衰減、爆頭倍率、載具裝甲與濺射傷害。
export class Combat {
  constructor(game) {
    this.game = game;
    this.world = game.physicsWorld;
    this.registry = game.registry;
    this.tmp = new THREE.Vector3();
  }

  ignoreSetFor(source, extra = []) {
    const set = new Set(extra);
    if (source && source.colliders) {
      for (const c of source.colliders) set.add(c.handle);
    }
    return set;
  }

  raycast(origin, dir, maxDist, ignore = null) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDist,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      ignore ? (collider) => !ignore.has(collider.handle) : undefined
    );
    if (!hit) return null;
    const point = origin.clone().addScaledVector(dir, hit.timeOfImpact);
    return {
      point,
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider,
      distance: hit.timeOfImpact,
      entry: this.registry.get(hit.collider.handle)
    };
  }

  hitscan(origin, dir, weapon, source, opts = {}) {
    const maxDist = weapon.range ?? 180;
    const ignore = this.ignoreSetFor(source);
    const hit = this.raycast(origin, dir, maxDist, ignore);
    const muzzle = opts.muzzlePos || origin.clone().addScaledVector(dir, 0.5);
    let endPoint;
    let result = { hit: false, killed: false, point: null };

    if (hit) {
      endPoint = hit.point;
      if (hit.entry && hit.entry.entity) {
        const entity = hit.entry.entity;
        const sameTeam = entity.team && source?.team && entity.team === source.team;
        if (!sameTeam && !entity.downed && !entity.dead) {
          let dmg = weapon.damage;
          const falloffT = clamp((hit.distance - (weapon.falloffStart ?? 20)) / Math.max(1, (weapon.falloffEnd ?? 60) - (weapon.falloffStart ?? 20)), 0, 1);
          dmg *= lerp(1, weapon.minDamage ?? 0.6, falloffT);
          if (hit.entry.part === 'head') dmg *= weapon.headMult ?? 2;
          if (entity.isVehicle) dmg *= 0.12;
          const killed = entity.takeDamage(dmg, source, hit.entry.part, hit.point);
          result = { hit: true, killed, point: hit.point, entity };
          if (opts.isPlayer ?? source?.isPlayer) this.game.ui.hud.hitmarker(killed);
          if (entity.isVehicle) this.game.effects.sparks(hit.point, hit.normal);
          else if (entity.isSoldier) this.game.effects.blood(hit.point, dir);
        }
      } else {
        this.game.effects.impact(hit.point, hit.normal);
      }
    } else {
      endPoint = origin.clone().addScaledVector(dir, maxDist);
    }

    this.game.effects.tracer(muzzle, endPoint);
    return result;
  }

  splash(center, radius, damage, source, opts = {}) {
    const targets = this.game.getDamageables();
    const sourceIgnore = this.ignoreSetFor(source);
    for (const entity of targets) {
      if (!entity || entity === source || entity.downed || entity.dead) continue;
      if (entity.team && source?.team && entity.team === source.team) continue;
      const targetPos = entity.isVehicle ? entity.getCenter() : entity.getCenter();
      const dist = center.distanceTo(targetPos);
      if (dist > radius) continue;

      const dir = targetPos.clone().sub(center).normalize();
      const ray = new RAPIER.Ray(center, dir);
      const hit = this.world.castRay(ray, dist, true, undefined, undefined, undefined, undefined, (collider) => !sourceIgnore.has(collider.handle));
      if (hit) {
        const entry = this.registry.get(hit.collider.handle);
        const visible = entry?.entity === entity || hit.timeOfImpact >= dist - 0.6;
        if (!visible) continue;
      }

      const falloff = 1 - (dist / radius) * 0.75;
      let amount = damage * falloff;
      if (entity.isVehicle && opts.vehicleDamage) amount = opts.vehicleDamage * falloff;
      entity.takeDamage(amount, source, 'splash', center);
    }
  }

  explode(position, opts = {}) {
    const radius = opts.radius ?? 6;
    const damage = opts.damage ?? 80;
    this.splash(position, radius, damage, opts.source, { vehicleDamage: opts.vehicleDamage });
    this.game.effects.explosion(position, radius);
    this.game.audio.playExplosion(position, radius / 6);
    this.game.addShake(clamp(radius * 0.08, 0.15, 1.2), position);
  }
}
