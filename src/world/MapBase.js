import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME } from '../config/game.js';
import { RNG } from '../core/Random.js';
import { Terrain } from './Terrain.js';
import { Sky } from './Sky.js';
import { NavGrid } from './NavGrid.js';
import { Weather } from './Weather.js';
import {
  StaticBatch,
  buildFlag,
  updateFlagVisual,
  setFlagOwner,
  buildGrass,
  buildDeadTrees,
  buildPuddles,
  SmokeEmitter,
  FireEmitter
} from './Props.js';

// 地圖基底：地形、光照、天空、旗點、環境細節與導航網格。
export class MapBase {
  constructor(game, meta) {
    this.game = game;
    this.meta = meta;
    this.scene = game.scene;
    this.world = game.physicsWorld;
    this.assets = game.assets;
    this.group = new THREE.Group();
    this.group.name = `map-${meta.id}`;
    this.time = 0;
    this.flags = [];
    this.smokeEmitters = [];
    this.fireEmitters = [];
    this.flashes = [];
    this.animated = [];
    this.rng = new RNG(meta.seed + 101);
    this.onProgress = null;
  }

  progress(label, value) {
    if (this.onProgress) this.onProgress(label, value);
  }

  async build(onProgress) {
    this.onProgress = onProgress;
    this.scene.add(this.group);

    this.progress('生成地形', 0.05);
    this.terrain = new Terrain(this.meta);
    this.waterLevel = this.terrain.waterLevel;
    const terrainData = this.terrain.build(this.assets);
    this.group.add(terrainData.mesh);
    this.terrainMesh = terrainData.mesh;
    if (terrainData.water) {
      this.group.add(terrainData.water);
      this.water = terrainData.water;
    }

    this.staticBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(terrainData.colliderDesc, this.staticBody);

    const edge = this.meta.size / 2 + 2;
    const wallHeight = 24;
    const wallThickness = 3;
    for (const [x, z, sx, sz] of [
      [0, -edge, this.meta.size + 8, wallThickness],
      [0, edge, this.meta.size + 8, wallThickness],
      [-edge, 0, wallThickness, this.meta.size + 8],
      [edge, 0, wallThickness, this.meta.size + 8]
    ]) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(sx / 2, wallHeight / 2, sz / 2).setTranslation(x, wallHeight / 2, z),
        this.staticBody
      );
    }

    this.batch = new StaticBatch(this.group, this.world, this.staticBody, this.assets);

    this.progress('佈置戰場', 0.2);
    await new Promise((r) => setTimeout(r, 0));
    this.setupLights();
    this.setupSky();
    this.buildLayout();
    this.batch.build();

    this.progress('建立旗點', 0.5);
    await new Promise((r) => setTimeout(r, 0));
    this.buildFlags();
    this.buildAmbient();
    await new Promise((r) => setTimeout(r, 0));

    this.progress('生成導航網格', 0.58);
    this.world.step();
    this.nav = new NavGrid(this);
    await this.nav.build((count, done) => {
      if (done) this.progress('導航完成', 0.94);
      else this.progress(`掃描可行走區域 ${count}`, 0.58 + Math.min(0.35, count / 220000));
    });

    this.weather = new Weather(this.group, this.meta, this.assets, this.game.camera, this.game.settings.quality);
    this.weather.setLights(this.dirLight, this.hemiLight);

    this.buildMinimap();
    this.game.audio.onLightning = () => this.weather.triggerLightning();
    this.game.audio.onDistantArtillery = (pos) => this.spawnDistantFlash(pos);

    this.progress('完成', 1);
  }

  setupLights() {
    const sky = this.meta.sky;
    const sunDir = new THREE.Vector3(...sky.sunDir).normalize();
    this.dirLight = new THREE.DirectionalLight(sky.light, sky.lightIntensity);
    this.dirLight.position.copy(sunDir).multiplyScalar(190);
    this.dirLight.target.position.set(0, 0, 0);
    this.dirLight.castShadow = true;
    const q = this.game.settings.quality;
    const shadowSize = q === 'low' ? 1024 : q === 'high' ? 4096 : 2048;
    this.dirLight.shadow.mapSize.set(shadowSize, shadowSize);
    const s = this.meta.size / 2 + 35;
    this.dirLight.shadow.camera.left = -s;
    this.dirLight.shadow.camera.right = s;
    this.dirLight.shadow.camera.top = s;
    this.dirLight.shadow.camera.bottom = -s;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 440;
    this.dirLight.shadow.bias = -0.0006;
    this.dirLight.shadow.normalBias = 0.045;
    this.group.add(this.dirLight);
    this.group.add(this.dirLight.target);

    this.hemiLight = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, sky.hemiIntensity);
    this.group.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xfff2df, 0.22);
    this.group.add(this.ambientLight);

    this.fillLight = new THREE.DirectionalLight(0xaabbcc, 0.55);
    this.fillLight.position.set(-sunDir.x * 100, 80, -sunDir.z * 100);
    this.group.add(this.fillLight);

    this.scene.fog = new THREE.FogExp2(sky.fog, sky.fogDensity);
    this.game.renderer.setClearColor(sky.fog, 1);
  }

  setupSky() {
    this.sky = new Sky(this.meta);
    this.group.add(this.sky.mesh);
  }

  buildLayout() {
    // 由子類別覆寫。
  }

  buildFlags() {
    for (const f of this.meta.flags) {
      const flag = buildFlag(this.group, this.assets, f, this.terrain);
      flag.owner = null;
      flag.progress = 0;
      this.flags.push(flag);
      setFlagOwner(flag, null, null);
    }
    // 最靠近地圖中心的旗點，AI 會固定派一組小隊爭奪。
    let center = null;
    let best = Infinity;
    for (const flag of this.flags) {
      const d = Math.hypot(flag.pos.x, flag.pos.z);
      if (d < best) {
        best = d;
        center = flag;
      }
    }
    this.centerFlag = center;
  }

  buildAmbient() {
    const features = this.meta.features;
    const smoke = features.smoke || [];
    for (const p of smoke) {
      const y = this.terrain.heightAt(p[0], p[1]);
      this.smokeEmitters.push(new SmokeEmitter(this.group, this.assets, new THREE.Vector3(p[0], y + 1.5, p[1]), {
        count: 14,
        height: this.meta.weather === 'rain' ? 16 : 24,
        speed: this.meta.weather === 'rain' ? 0.8 : 1.1,
        spread: 4
      }));
    }
    for (const p of features.fires || []) {
      const y = this.terrain.heightAt(p[0], p[1]);
      this.fireEmitters.push(new FireEmitter(this.group, this.assets, new THREE.Vector3(p[0], y + 0.4, p[1])));
    }

    const grassCount = this.meta.weather === 'rain' ? 420 : 760;
    this.grass = buildGrass(this.group, this.assets, this.rng, this.terrain, grassCount);

    const treeCount = features.forest?.count ?? 20;
    buildDeadTrees(this.batch, this.rng, this.terrain, treeCount, { half: this.meta.size / 2 - 14 });

    if (features.puddles) {
      const count = this.meta.weather === 'rain' ? 46 : 22;
      this.puddleMat = this.assets.materials.water.clone();
      this.puddleMat.opacity = 0.6;
      this.puddleMat.roughness = 0.04;
      this.puddleMat.userData.owned = true;
      this.puddles = buildPuddles(this.group, this.puddleMat, this.rng, this.terrain, count);
    }
    this.batch.build();
  }

  spawnDistantFlash(pos) {
    const mat = this.assets.sprites.flash.clone();
    mat.opacity = 0.8;
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(pos.x, 26, pos.z);
    sprite.scale.set(26, 26, 1);
    this.group.add(sprite);
    this.flashes.push({ sprite, life: 0.35 });
  }

  buildMinimap() {
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const half = this.meta.size / 2;
    const water = new THREE.Color(this.meta.terrain.river ? '#3e5964' : '#3e5964');
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = -half + (px + 0.5) / size * this.meta.size;
        const z = -half + (py + 0.5) / size * this.meta.size;
        let c;
        if (this.terrain.isWater(x, z)) {
          c = water;
        } else {
          const h = this.terrain.heightAt(x, z);
          c = this.terrain.colorAt(x, z, h, this.terrain.slopeAt(x, z));
        }
        const i = (py * size + px) * 4;
        img.data[i] = c.r * 255;
        img.data[i + 1] = c.g * 255;
        img.data[i + 2] = c.b * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.minimapCanvas = canvas;
  }

  heightAt(x, z) {
    return this.terrain.heightAt(x, z);
  }

  isDeepWater(x, z) {
    return this.terrain.isDeepWater(x, z);
  }

  surfaceAt(x, z) {
    return this.terrain.surfaceAt(x, z);
  }

  getFlag(id) {
    return this.flags.find((f) => f.id === id) || null;
  }

  getHQ(team) {
    return this.meta.spawns.find((s) => s.team === team) || this.meta.spawns[0];
  }

  getSpawn(team, flagId = null) {
    let base = null;
    if (flagId) {
      const flag = this.getFlag(flagId);
      if (flag && flag.owner === team) {
        for (let i = 0; i < 16; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          const r = this.rng.range(2, Math.max(3, flag.radius - 4));
          const x = flag.pos.x + Math.cos(a) * r;
          const z = flag.pos.z + Math.sin(a) * r;
          if (this.nav.isWalkableAt(x, z) && !this.terrain.isDeepWater(x, z)) {
            return new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.15, z);
          }
        }
        base = { pos: [flag.pos.x, flag.pos.z] };
      }
    }
    if (!base) base = this.getHQ(team);
    const hq = base.pos;
    for (let i = 0; i < 16; i++) {
      const x = hq[0] + this.rng.range(-9, 9);
      const z = hq[1] + this.rng.range(-9, 9);
      if (this.nav.isWalkableAt(x, z) && !this.terrain.isDeepWater(x, z)) {
        return new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.15, z);
      }
    }
    return new THREE.Vector3(hq[0], this.terrain.heightAt(hq[0], hq[1]) + 0.2, hq[1]);
  }

  getDeployPoints(team) {
    const points = [];
    const hq = this.getHQ(team);
    points.push({ id: 'hq', name: hq.name, pos: hq.pos, kind: 'hq' });
    for (const flag of this.flags) {
      if (flag.owner === team) {
        points.push({ id: flag.id, name: `${flag.id} · ${flag.name}`, pos: [flag.pos.x, flag.pos.z], kind: 'flag' });
      }
    }
    return points;
  }

  getVehicleSpawns() {
    return this.meta.vehicles.map((v) => ({
      ...v,
      y: this.terrain.heightAt(v.pos[0], v.pos[1])
    }));
  }

  update(dt) {
    this.time += dt;
    this.sky.update(dt, this.game.camera);
    this.weather.update(dt);
    for (const flag of this.flags) updateFlagVisual(flag, this.time);
    for (const s of this.smokeEmitters) s.update(dt);
    for (const f of this.fireEmitters) f.update(dt);
    for (const a of this.animated) a(dt);
    if (this.water) this.water.position.y = this.meta.terrain.river.waterLevel + Math.sin(this.time * 0.8) * 0.035;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.sprite.material.opacity = Math.max(0, f.life / 0.35) * 0.8;
      if (f.life <= 0) {
        this.group.remove(f.sprite);
        f.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && obj.material.userData && obj.material.userData.owned) obj.material.dispose();
      if (obj.material && obj.material.dispose && obj.isSprite && obj.material.userData?.owned) obj.material.dispose();
    });
    for (const s of this.smokeEmitters) s.dispose();
    for (const f of this.fireEmitters) f.dispose();
    if (this.weather) this.weather.dispose();
    if (this.sky) this.sky.dispose();
    if (this.puddleMat) this.puddleMat.dispose();
    this.smokeEmitters = [];
    this.fireEmitters = [];
    this.flashes = [];
    this.scene.fog = null;
    this.game.audio.onLightning = null;
    this.game.audio.onDistantArtillery = null;
  }
}
