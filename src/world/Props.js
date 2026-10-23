import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../core/Random.js';
import { clamp, distanceToPolyline } from '../core/MathUtils.js';

// 將大量靜態方塊/圓柱合併成少量 draw call，並同步建立碰撞體。
export class StaticBatch {
  constructor(group, world, staticBody, assets) {
    this.group = group;
    this.world = world;
    this.staticBody = staticBody;
    this.assets = assets;
    this.buckets = new Map();
    this.tempQuat = new THREE.Quaternion();
    this.tempEuler = new THREE.Euler();
    this.tempMatrix = new THREE.Matrix4();
  }

  bucket(key) {
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    return this.buckets.get(key);
  }

  addColliderBox(sx, sy, sz, x, y, z, quat) {
    const desc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
      .setTranslation(x, y, z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setFriction(0.9);
    this.world.createCollider(desc, this.staticBody);
  }

  addColliderCylinder(radius, halfHeight, x, y, z, quat) {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
      .setTranslation(x, y, z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setFriction(0.9);
    this.world.createCollider(desc, this.staticBody);
  }

  addBox(sx, sy, sz, x, y, z, rotY = 0, matKey = 'wood', collide = true, rotX = 0, rotZ = 0) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    this.tempEuler.set(rotX, rotY, rotZ, 'YXZ');
    this.tempQuat.setFromEuler(this.tempEuler);
    this.tempMatrix.compose(new THREE.Vector3(x, y, z), this.tempQuat, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(this.tempMatrix);
    this.bucket(matKey).push(geo);
    if (collide) this.addColliderBox(sx, sy, sz, x, y, z, this.tempQuat);
  }

  addCylinder(radiusTop, radiusBottom, height, x, y, z, rotX = 0, rotY = 0, rotZ = 0, matKey = 'wood', collide = true, radialSegments = 8) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    this.tempEuler.set(rotX, rotY, rotZ, 'YXZ');
    this.tempQuat.setFromEuler(this.tempEuler);
    this.tempMatrix.compose(new THREE.Vector3(x, y, z), this.tempQuat, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(this.tempMatrix);
    this.bucket(matKey).push(geo);
    if (collide) this.addColliderCylinder(Math.max(radiusTop, radiusBottom), height / 2, x, y, z, this.tempQuat);
  }

  addGeometry(geo, matKey) {
    this.bucket(matKey).push(geo);
  }

  build() {
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.assets.materials[key] || this.assets.materials.wood);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.buckets.clear();
  }
}

export function buildSandbagWall(batch, points, height = 0.9, terrain, offset = 0) {
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s];
    const b = points[s + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const nx = dz / len;
    const nz = -dx / len;
    const count = Math.max(1, Math.floor(len / 0.82));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = a[0] + dx * t + nx * offset;
      const z = a[1] + dz * t + nz * offset;
      const y = terrain.heightAt(x, z);
      const layers = Math.max(1, Math.floor(height / 0.33));
      for (let l = 0; l < layers; l++) {
        const jitter = (i + l) % 2 === 0 ? 0.06 : -0.06;
        batch.addBox(0.82, 0.33, 0.48, x + nx * jitter, y + 0.18 + l * 0.32, z + nz * jitter, angle, 'sandbag', true);
      }
    }
  }
}

export function buildBarbedWire(scene, batch, assets, points, terrain, offset = 0) {
  const wirePositions = [];
  let prev = null;
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s];
    const b = points[s + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const nx = dz / len;
    const nz = -dx / len;
    const count = Math.max(2, Math.floor(len / 3.2));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = a[0] + dx * t + nx * offset;
      const z = a[1] + dz * t + nz * offset;
      const y = terrain.heightAt(x, z);
      batch.addBox(0.12, 1.35, 0.12, x, y + 0.68, z, 0, 'woodDark', false);
      if (prev) {
        for (let strand = 0; strand < 3; strand++) {
          const y1 = prev.y + 0.35 + strand * 0.3;
          const y2 = y + 0.35 + strand * 0.3;
          wirePositions.push(prev.x, y1, prev.z, x, y2, z);
          wirePositions.push(prev.x, y1, prev.z, x, y2 + 0.12, z);
        }
      }
      prev = { x, y, z };
    }
  }
  if (wirePositions.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
    const lines = new THREE.LineSegments(geo, assets.materials.wire);
    lines.frustumCulled = false;
    scene.add(lines);
  }
}

export function buildCrates(world, scene, assets, rng, positions, size = 0.9) {
  const out = [];
  for (const p of positions) {
    const s = size * rng.range(0.8, 1.25);
    const geo = new THREE.BoxGeometry(s, s * 0.85, s);
    const mesh = new THREE.Mesh(geo, assets.materials.wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const y = p.y ?? 0;
    mesh.position.set(p.x, y + s * 0.5, p.z);
    mesh.rotation.y = rng.range(0, Math.PI);
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z).setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(s / 2, s * 0.42, s / 2).setFriction(0.8).setRestitution(0.1), body);
    out.push({ mesh, body });
  }
  return out;
}

export function buildBarrels(world, scene, assets, rng, positions) {
  const out = [];
  for (const p of positions) {
    const r = rng.range(0.32, 0.45);
    const h = rng.range(0.85, 1.15);
    const geo = new THREE.CylinderGeometry(r, r, h, 10);
    const mesh = new THREE.Mesh(geo, assets.materials.metalDark);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const y = p.y ?? 0;
    mesh.position.set(p.x, y + h * 0.5, p.z);
    mesh.rotation.y = rng.range(0, Math.PI);
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r).setFriction(0.7).setRestitution(0.2), body);
    out.push({ mesh, body });
  }
  return out;
}

export function buildDeadTrees(batch, rng, terrain, count, bounds = null) {
  const half = bounds?.half ?? terrain.size / 2 - 12;
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    let tries = 0;
    do {
      x = rng.range(-half, half);
      z = rng.range(-half, half);
      tries++;
    } while (tries < 12 && terrain.isWater(x, z));
    const y = terrain.heightAt(x, z);
    if (terrain.isWater(x, z)) continue;
    const h = rng.range(4.5, 8.5);
    const lean = rng.range(-0.12, 0.12);
    batch.addCylinder(0.12, 0.3, h, x, y + h * 0.5, z, lean, rng.range(0, Math.PI), rng.range(-0.1, 0.1), 'tree', true, 6);
    const branches = rng.int(2, 4);
    for (let b = 0; b < branches; b++) {
      const by = y + h * rng.range(0.45, 0.9);
      const ang = rng.range(0, Math.PI * 2);
      const bl = rng.range(1.0, 2.6);
      batch.addCylinder(0.04, 0.09, bl, x + Math.cos(ang) * bl * 0.3, by, z + Math.sin(ang) * bl * 0.3, Math.PI / 2.4, ang, 0, 'tree', false, 5);
    }
  }
}

export function buildGrass(scene, assets, rng, terrain, count) {
  const geo = new THREE.ConeGeometry(0.055, 0.42, 3);
  const mat = assets.materials.grass;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const half = terrain.size / 2 - 10;
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    let tries = 0;
    do {
      x = rng.range(-half, half);
      z = rng.range(-half, half);
      tries++;
    } while (tries < 8 && terrain.isWater(x, z));
    const y = terrain.heightAt(x, z);
    const s = rng.range(0.6, 1.4);
    q.setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0));
    m.compose(new THREE.Vector3(x, y + 0.2 * s, z), q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  return inst;
}

export function buildPuddles(scene, material, rng, terrain, count, area = null) {
  const mat = material;
  const group = new THREE.Group();
  const half = area ? area[2] : terrain.size / 2 - 20;
  const cx = area ? area[0] : 0;
  const cz = area ? area[1] : 0;
  for (let i = 0; i < count; i++) {
    const x = cx + rng.range(-half, half);
    const z = cz + rng.range(-half, half);
    const y = terrain.heightAt(x, z);
    if (terrain.isWater(x, z)) continue;
    const r = rng.range(1.2, 4.5);
    const geo = new THREE.CircleGeometry(r, 12);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.025, z);
    mesh.scale.set(1, 1, rng.range(0.6, 1.2));
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

export class SmokeEmitter {
  constructor(scene, assets, pos, opts = {}) {
    this.scene = scene;
    this.sprites = [];
    this.count = opts.count ?? 14;
    this.height = opts.height ?? 22;
    this.speed = opts.speed ?? 1.1;
    this.spread = opts.spread ?? 3.5;
    this.color = opts.color ?? 0x9d968a;
    this.opacity = opts.opacity ?? 0.35;
    this.rng = new RNG(Math.floor(pos.x * 31 + pos.z * 17) + 5);
    this.pos = pos;
    for (let i = 0; i < this.count; i++) {
      const mat = assets.sprites.smoke.clone();
      mat.color.setHex(this.color);
      mat.opacity = 0;
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(pos.x, pos.y, pos.z);
      sprite.scale.set(2, 2, 1);
      scene.add(sprite);
      this.sprites.push({
        sprite,
        life: this.rng.range(0, 1),
        speed: this.rng.range(0.7, 1.3) * this.speed,
        drift: this.rng.range(-1, 1) * 0.6,
        driftZ: this.rng.range(-1, 1) * 0.6,
        size: this.rng.range(1.2, 2.4)
      });
    }
  }

  update(dt) {
    for (const s of this.sprites) {
      s.life += dt * s.speed * 0.12;
      if (s.life > 1) s.life = 0;
      const t = s.life;
      s.sprite.position.set(
        this.pos.x + Math.sin(t * 7 + s.drift) * this.spread * t + s.drift * t * 6,
        this.pos.y + t * this.height,
        this.pos.z + Math.cos(t * 5 + s.driftZ) * this.spread * t + s.driftZ * t * 6
      );
      const scale = s.size + t * 6;
      s.sprite.scale.set(scale, scale, 1);
      s.sprite.material.opacity = Math.sin(t * Math.PI) * this.opacity;
    }
  }

  dispose() {
    for (const s of this.sprites) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
    this.sprites = [];
  }
}

export class FireEmitter {
  constructor(scene, assets, pos) {
    this.scene = scene;
    this.sprites = [];
    this.light = new THREE.PointLight(0xff8a3a, 12, 24, 2);
    this.light.position.set(pos.x, pos.y + 1.2, pos.z);
    scene.add(this.light);
    this.rng = new RNG(Math.floor(pos.x * 13 + pos.z * 29) + 3);
    this.pos = pos;
    for (let i = 0; i < 8; i++) {
      const mat = assets.sprites.fire.clone();
      mat.opacity = 0;
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(pos.x, pos.y + 0.4, pos.z);
      sprite.scale.set(1.2, 1.8, 1);
      scene.add(sprite);
      this.sprites.push({ sprite, life: this.rng.range(0, 1), speed: this.rng.range(0.8, 1.5), off: this.rng.range(-0.5, 0.5) });
    }
    this.flicker = 0;
  }

  update(dt) {
    this.flicker += dt * 8;
    this.light.intensity = 9 + Math.sin(this.flicker) * 2 + Math.sin(this.flicker * 2.7) * 1.5;
    for (const s of this.sprites) {
      s.life += dt * s.speed * 0.9;
      if (s.life > 1) s.life = 0;
      const t = s.life;
      s.sprite.position.set(this.pos.x + s.off * t, this.pos.y + 0.3 + t * 2.2, this.pos.z + s.off * 0.5 * t);
      const sc = 0.6 + t * 0.8;
      s.sprite.scale.set(sc, sc * 1.5, 1);
      s.sprite.material.opacity = Math.sin(t * Math.PI) * 0.85;
    }
  }

  dispose() {
    for (const s of this.sprites) {
      this.scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
    this.scene.remove(this.light);
    this.sprites = [];
  }
}

export function buildArtillery(batch, x, z, rotY, terrain, assets) {
  const y = terrain.heightAt(x, z);
  batch.addBox(1.8, 0.5, 2.6, x, y + 0.8, z, rotY, 'metalDark', true);
  batch.addCylinder(0.18, 0.22, 3.4, x, y + 1.3, z, Math.PI / 2 - 0.25, rotY, 0, 'metalDark', true, 8);
  batch.addCylinder(0.55, 0.55, 0.18, x - Math.cos(rotY) * 0.9, y + 0.55, z + Math.sin(rotY) * 0.9, Math.PI / 2, rotY, 0, 'metalDark', false, 10);
  batch.addCylinder(0.55, 0.55, 0.18, x + Math.cos(rotY) * 0.9, y + 0.55, z - Math.sin(rotY) * 0.9, Math.PI / 2, rotY, 0, 'metalDark', false, 10);
  batch.addBox(2.2, 1.1, 0.18, x, y + 1.05, z + Math.cos(rotY) * 0.6, rotY, 'metalDark', false);
  void assets;
}

export function buildCart(batch, x, z, rotY, terrain) {
  const y = terrain.heightAt(x, z);
  batch.addBox(2.2, 0.5, 1.2, x, y + 0.75, z, rotY, 'wood', true);
  batch.addBox(2.2, 0.55, 0.1, x, y + 1.1, z - 0.55, rotY, 'wood', false);
  for (const [ox, oz] of [[-0.8, -0.55], [0.8, -0.55], [-0.8, 0.55], [0.8, 0.55]]) {
    batch.addCylinder(0.45, 0.45, 0.12, x + Math.cos(rotY) * ox - Math.sin(rotY) * oz, y + 0.45, z + Math.sin(rotY) * ox + Math.cos(rotY) * oz, 0, 0, Math.PI / 2, 'woodDark', false, 10);
  }
}

export function buildWell(batch, x, z, terrain) {
  const y = terrain.heightAt(x, z);
  batch.addCylinder(1.3, 1.4, 1.1, x, y + 0.55, z, 0, 0, 0, 'stone', true, 12);
  batch.addBox(0.16, 2.2, 0.16, x - 1.2, y + 2.1, z, 0, 'wood', true);
  batch.addBox(0.16, 2.2, 0.16, x + 1.2, y + 2.1, z, 0, 'wood', true);
  batch.addBox(2.8, 0.16, 1.5, x, y + 3.2, z, 0, 'roof', false);
}

export function buildRubble(batch, x, z, radius, count, terrain) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    const y = terrain.heightAt(px, pz);
    const s = 0.2 + Math.random() * 0.9;
    batch.addBox(s, s * 0.5, s * 0.8, px, y + s * 0.25, pz, Math.random() * Math.PI, 'rubble', true);
  }
}

export function buildGravestones(batch, rng, terrain, count, center, radius) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * radius;
    const x = center[0] + Math.cos(a) * r;
    const z = center[1] + Math.sin(a) * r;
    const y = terrain.heightAt(x, z);
    const h = rng.range(0.5, 1.1);
    batch.addBox(0.45, h, 0.12, x, y + h / 2, z, rng.range(-0.3, 0.3), 'stoneDark', true);
  }
}

export function buildRailway(batch, points, terrain) {
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s];
    const b = points[s + 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const nx = dz / len;
    const nz = -dx / len;
    const count = Math.max(1, Math.floor(len / 2));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = a[0] + dx * t;
      const z = a[1] + dz * t;
      const y = terrain.heightAt(x, z);
      batch.addBox(2.4, 0.12, 0.35, x, y + 0.14, z, angle, 'woodDark', false);
      batch.addBox(0.1, 0.14, len / count, x + nx * 0.7, y + 0.28, z + nz * 0.7, angle, 'metalDark', false);
      batch.addBox(0.1, 0.14, len / count, x - nx * 0.7, y + 0.28, z - nz * 0.7, angle, 'metalDark', false);
    }
  }
}

export function buildFlag(scene, assets, flag, terrain) {
  const y = terrain.heightAt(flag.pos[0], flag.pos[1]);
  const group = new THREE.Group();
  group.position.set(flag.pos[0], y, flag.pos[1]);
  scene.add(group);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), assets.materials.metalDark);
  pole.position.y = 3.5;
  pole.castShadow = true;
  group.add(pole);

  const clothGeo = new THREE.PlaneGeometry(2.6, 1.5, 10, 6);
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xbdb6a8,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0
  });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.set(1.3, 6.1, 0);
  cloth.castShadow = true;
  group.add(cloth);

  const ringGeo = new THREE.RingGeometry(flag.radius - 0.6, flag.radius, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.06;
  group.add(ring);

  const letterMat = assets.letterSprite(flag.id);
  const letter = new THREE.Sprite(letterMat.clone());
  letter.position.set(0, 8.4, 0);
  letter.scale.set(2.2, 2.2, 1);
  group.add(letter);

  return {
    id: flag.id,
    name: flag.name,
    pos: new THREE.Vector3(flag.pos[0], y, flag.pos[1]),
    radius: flag.radius,
    group,
    pole,
    cloth,
    clothMat,
    clothGeo,
    clothBase: clothGeo.attributes.position.array.slice(),
    ring,
    ringMat,
    letter,
    letterMat,
    owner: null,
    progress: 0
  };
}

export function updateFlagVisual(flag, time) {
  const posAttr = flag.clothGeo.attributes.position;
  const base = flag.clothBase;
  for (let i = 0; i < posAttr.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const wave = Math.sin(time * 2.4 + x * 2.1 + y * 1.2) * 0.12 * ((x + 1.3) / 2.6);
    posAttr.setZ(i, wave);
  }
  posAttr.needsUpdate = true;
  flag.clothGeo.computeVertexNormals();
  flag.ringMat.opacity = 0.25 + Math.sin(time * 2) * 0.06;
}

export function setFlagOwner(flag, team, colors) {
  flag.owner = team;
  if (!team) {
    flag.clothMat.color.setHex(0xbdb6a8);
    flag.ringMat.color.setHex(0xffffff);
    flag.letter.material.color.setHex(0xffffff);
    return;
  }
  const c = new THREE.Color(colors[team]);
  flag.clothMat.color.copy(c);
  flag.ringMat.color.copy(c);
  flag.letter.material.color.copy(c);
}
