import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME, STORAGE_KEY } from '../config/game.js';
import { CLASS_LIST } from '../config/classes.js';
import { createMap } from '../world/MapRegistry.js';
import { Sky } from '../world/Sky.js';
import { SmokeEmitter } from '../world/Props.js';
import { Player } from '../entities/Player.js';
import { BotDirector } from '../entities/BotDirector.js';
import { Tank } from '../entities/Tank.js';
import { Jeep } from '../entities/Jeep.js';
import { Projectile } from '../entities/Projectile.js';
import { Pickup } from '../entities/Pickup.js';
import { Combat } from '../systems/Combat.js';
import { Capture } from '../systems/Capture.js';
import { Effects } from '../systems/Effects.js';
import { PostFX } from '../systems/PostFX.js';
import { UIManager } from '../ui/UIManager.js';
import { Assets } from './Assets.js';
import { AudioSystem } from './Audio.js';
import { Input } from './Input.js';
import { Registry } from './Registry.js';

const DEFAULT_SETTINGS = {
  sensitivity: 0.0022,
  fov: 80,
  quality: 'medium',
  master: 0.8,
  sfx: 0.8,
  ambient: 0.5,
  invertY: false,
  showFps: true,
  brightness: 1.4
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// 遊戲主控：狀態機、物理步進、地圖切換、勝負與所有系統整合。
export class Game {
  constructor(container) {
    this.container = container;
    this.settings = loadSettings();
    this.state = 'menu';
    this.time = 0;
    this.fps = 60;
    this.frame = 0;
    this.last = 0;
    this.accumulator = 0;
    this.mapId = 'ashen-valley';
    this.playerTeam = GAME.playerTeam;
    this.tickets = { A: GAME.tickets, B: GAME.tickets };
    this.roundTimeLeft = GAME.roundTime;
    this.roundActive = false;
    this.bleedTimer = 2.5;
    this.spotted = new Map();
    this.bots = [];
    this.vehicles = [];
    this.projectiles = [];
    this.pickups = [];
    this.player = null;
    this.botDirector = null;
    this.capture = null;
    this.effects = null;
    this.combat = null;
    this.world = null;
    this.physicsWorld = null;
    this.eventQueue = null;
    this.registry = new Registry();
    this.shakeOffset = new THREE.Vector3();
    this.shakeRot = new THREE.Vector2();
    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.menuAngle = 0;
    this.deployCamAngle = 0;
    this.deployClass = 'assault';
    this.deploySpawn = 'hq';
    this.deployCountdown = 0;
    this.deployRefreshTimer = 0;
    this.menuSmoke = [];
    this.menuMeta = {
      id: 'menu',
      weather: 'mist',
      seed: 1916,
      sky: {
        top: '#1a2233',
        horizon: '#b97448',
        ground: '#241d18',
        sun: '#ffc27a',
        sunDir: [0.55, 0.12, 0.35],
        cloud: 0.55,
        fog: '#3a2c22',
        fogDensity: 0.018,
        light: '#ffbe7a',
        lightIntensity: 2.2,
        hemiSky: '#7a8fa8',
        hemiGround: '#3a2f28',
        hemiIntensity: 0.6
      }
    };
  }

  async init() {
    await RAPIER.init();
    window.RAPIER = RAPIER;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.settings.brightness ?? 1.4;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.assets = new Assets();
    this.assets.init();

    this.input = new Input(this.renderer.domElement);
    this.input.onAnyInput = () => {
      this.audio.init();
    };
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
    };

    this.audio = new AudioSystem();
    this.audio.setVolumes({
      master: this.settings.master,
      sfx: this.settings.sfx,
      ambient: this.settings.ambient
    });

    this.buildMenuScene();
    this.postfx = new PostFX(this);
    this.postfx.setScene(this.menuScene, this.menuCamera);
    this.postfx.setTint('#ffe6c9');
    this.postfx.setQuality(this.settings.quality, { w: window.innerWidth, h: window.innerHeight });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.ui = new UIManager(this);
    this.ui.showMenu();
    this.postfx.setScene(this.menuScene, this.menuCamera);
    this.renderer.setClearColor('#3a2c22', 1);

    this.bindEvents();
    this.loopBound = this.loop.bind(this);
    this.last = performance.now();
    requestAnimationFrame(this.loopBound);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.menuCamera.aspect = w / h;
    this.menuCamera.updateProjectionMatrix();
    this.postfx.setSize(w, h);
    if (this.player?.viewmodel) this.player.viewmodel.resize(w, h);
  }

  buildMenuScene() {
    this.menuScene = new THREE.Scene();
    this.menuCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
    this.menuScene.fog = new THREE.FogExp2(this.menuMeta.sky.fog, this.menuMeta.sky.fogDensity);

    this.menuSky = new Sky(this.menuMeta);
    this.menuScene.add(this.menuSky.mesh);

    const hemi = new THREE.HemisphereLight(this.menuMeta.sky.hemiSky, this.menuMeta.sky.hemiGround, this.menuMeta.sky.hemiIntensity);
    this.menuScene.add(hemi);
    const sunDir = new THREE.Vector3(...this.menuMeta.sky.sunDir).normalize();
    const dir = new THREE.DirectionalLight(this.menuMeta.sky.light, this.menuMeta.sky.lightIntensity);
    dir.position.copy(sunDir).multiplyScalar(100);
    this.menuScene.add(dir);

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    this.menuScene.add(ground);

    const ruinMat = this.assets.materials.rubble;
    const woodMat = this.assets.materials.woodDark;
    const stoneMat = this.assets.materials.stone;
    const addBox = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.menuScene.add(m);
      return m;
    };

    addBox(18, 8, 12, -10, 2.5, -30, ruinMat);
    addBox(6, 18, 6, -12, 7.5, -34, stoneMat);
    addBox(6.6, 0.8, 6.6, -12, 16.8, -34, stoneMat);
    addBox(8, 5, 8, 14, 1, -32, ruinMat);
    addBox(10, 3, 6, 2, 0.2, -24, ruinMat);
    addBox(3, 1.2, 4, 22, 0.2, -20, woodMat);
    addBox(1.6, 1.2, 3.5, -24, 0.2, -18, woodMat);
    addBox(0.4, 6, 0.4, -4, 2.5, -22, woodMat);
    addBox(2.4, 0.5, 0.1, -4, 5.4, -22, woodMat);

    for (let i = 0; i < 8; i++) {
      addBox(0.6, 1.4, 0.6, -30 + i * 8, 0.2, -12 + (i % 2) * 2, ruinMat);
    }

    const wreckMat = this.assets.materials.metalDark;
    addBox(2.6, 1.1, 5, 10, 0.4, -14, wreckMat);
    addBox(1.7, 0.7, 1.8, 10, 1.0, -13.5, wreckMat);
    addBox(0.16, 0.16, 2.4, 10, 1.1, -15.5, wreckMat);

    const lanternMat = this.assets.materials.emissiveLamp;
    for (const [x, z] of [[-6, -20], [16, -24], [-20, -16]]) {
      addBox(0.18, 3.4, 0.18, x, 0.7, z, woodMat);
      addBox(0.4, 0.4, 0.4, x, 2.4, z, lanternMat);
      const light = new THREE.PointLight(0xffb45e, 8, 22, 2);
      light.position.set(x, 2.4, z);
      this.menuScene.add(light);
    }

    for (const [x, z] of [[-14, -28], [18, -30], [2, -36]]) {
      this.menuSmoke.push(new SmokeEmitter(this.menuScene, this.assets, new THREE.Vector3(x, 0.5, z), {
        count: 10,
        height: 20,
        speed: 0.9,
        spread: 4,
        opacity: 0.28
      }));
    }

    this.menuCamera.position.set(0, 4, 18);
    this.menuCamera.lookAt(0, 3, -16);
  }

  updateMenuScene(dt) {
    this.menuAngle += dt * 0.035;
    this.menuCamera.position.set(Math.cos(this.menuAngle) * 22, 4.5, Math.sin(this.menuAngle) * 22 - 2);
    this.menuCamera.lookAt(0, 3, -16);
    this.menuSky.update(dt, this.menuCamera);
    for (const s of this.menuSmoke) s.update(dt);
    this.audio.updateListener(this.menuCamera);
  }

  showMenu() {
    this.state = 'menu';
    this.input.exitLock();
    this.disposeMatch();
    this.ui.showMenu();
    this.postfx.setScene(this.menuScene, this.menuCamera);
    this.postfx.setTint('#ffe6c9');
    this.postfx.setDamage(0);
    this.renderer.setClearColor('#3a2c22', 1);
    this.menuAngle = 0;
    if (this.audio.ctx) this.audio.startAmbient(this.menuMeta);
  }

  showMapSelect() {
    this.state = 'mapselect';
    this.input.exitLock();
    this.disposeMatch();
    this.ui.showMapSelect();
    this.postfx.setScene(this.menuScene, this.menuCamera);
    this.postfx.setTint('#ffe6c9');
    this.renderer.setClearColor('#3a2c22', 1);
    if (this.audio.ctx) this.audio.startAmbient(this.menuMeta);
  }

  async startMatch(mapId) {
    if (this.state === 'loading') return;
    this.state = 'loading';
    this.input.exitLock();
    this.ui.showLoading('正在部署戰場', 0);
    this.disposeMatch();
    this.mapId = mapId;
    this.registry.clear();

    this.physicsWorld = new RAPIER.World({ x: 0, y: GAME.gravity, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);

    try {
      this.world = createMap(this, mapId);
      await this.world.build((label, progress) => this.ui.showLoading(label, progress));
    } catch (err) {
      console.error('地圖建立失敗', err);
      this.ui.showLoading('地圖建立失敗，請重新整理頁面', 1);
      return;
    }

    this.effects = new Effects(this);
    this.combat = new Combat(this);
    this.capture = new Capture(this);
    this.spawnVehicles();
    this.spawnAmmoCrates();

    this.tickets = { A: GAME.tickets, B: GAME.tickets };
    this.roundTimeLeft = GAME.roundTime;
    this.roundActive = false;
    this.bleedTimer = 2.5;
    this.spotted.clear();
    this.projectiles = [];
    this.pickups = this.pickups || [];
    this.deployCountdown = 0;
    this.deploySpawn = 'hq';
    this.deployRefreshTimer = 0;
    this.deployCamAngle = 0;
    this.accumulator = 0;

    if (this.player) {
      this.player.kills = 0;
      this.player.deaths = 0;
      this.player.score = 0;
      this.player.captures = 0;
      this.player.dead = true;
      this.player.downed = false;
      this.player.inVehicle = null;
      if (this.player.viewmodel) this.player.viewmodel.setHidden(true);
      this.ui.hud.setPlayer(this.player);
    }

    this.state = 'deploy';
    this.ui.hideLoading();
    this.ui.showDeploy(this.getDeployData());
    this.postfx.setScene(this.scene, this.camera);
    this.postfx.setTint(this.world.meta.tint);
    this.postfx.setDamage(0);
    this.renderer.setClearColor(this.world.meta.sky.fog, 1);
    this.updateDeployCamera(0);
    if (this.audio.ctx) this.audio.startAmbient(this.world.meta);
  }

  spawnVehicles() {
    for (const v of this.world.getVehicleSpawns()) {
      const opts = {
        type: v.type,
        team: v.team,
        pos: v.pos,
        y: v.y,
        rot: v.rot
      };
      const vehicle = v.type === 'tank' ? new Tank(this, opts) : new Jeep(this, opts);
      this.vehicles.push(vehicle);
    }
  }

  spawnAmmoCrates() {
    for (const flag of this.world.flags) {
      const y = this.world.heightAt(flag.pos.x, flag.pos.z);
      this.spawnPickup('ammo', new THREE.Vector3(flag.pos.x, y + 0.05, flag.pos.z), null);
    }
    for (const s of this.world.meta.spawns) {
      const y = this.world.heightAt(s.pos[0], s.pos[1]);
      this.spawnPickup('ammo', new THREE.Vector3(s.pos[0] + 3, y + 0.05, s.pos[1] + 3), s.team);
    }
  }

  getDeployData() {
    if (!this.world) {
      return {
        map: null,
        classes: CLASS_LIST,
        selectedClass: this.deployClass,
        selectedSpawn: 'hq',
        spawns: [],
        countdown: this.deployCountdown,
        stats: { kills: 0, deaths: 0, score: 0, captures: 0 },
        team: this.playerTeam
      };
    }
    const spawns = this.world.getDeployPoints(this.playerTeam);
    let selectedSpawn = this.deploySpawn;
    if (!spawns.some((s) => s.id === selectedSpawn)) selectedSpawn = 'hq';
    this.deploySpawn = selectedSpawn;
    const p = this.player;
    return {
      map: this.world.meta,
      classes: CLASS_LIST,
      selectedClass: this.deployClass,
      selectedSpawn,
      spawns,
      countdown: this.deployCountdown,
      stats: p ? { kills: p.kills, deaths: p.deaths, score: p.score, captures: p.captures } : { kills: 0, deaths: 0, score: 0, captures: 0 },
      team: this.playerTeam
    };
  }

  setDeployClass(classId) {
    if (CLASS_LIST.includes(classId)) this.deployClass = classId;
  }

  setDeploySpawn(id) {
    this.deploySpawn = id;
  }

  deploy() {
    if (this.state !== 'deploy' || !this.world || this.deployCountdown > 0) return;
    if (!this.player) {
      this.player = new Player(this);
      this.ui.hud.setPlayer(this.player);
    }
    const spawn = this.world.getSpawn(this.playerTeam, this.deploySpawn === 'hq' ? null : this.deploySpawn);
    this.player.spawn(this.deployClass, spawn);
    if (!this.botDirector) this.botDirector = new BotDirector(this);
    if (this.botDirector.bots.length === 0) this.botDirector.spawnAll();
    this.bots = this.botDirector.bots;

    this.state = 'playing';
    this.roundActive = true;
    this.accumulator = 0;
    this.ui.menus.hideAll();
    this.ui.hud.setPlayer(this.player);
    this.ui.hud.setupWorld();
    this.ui.hud.show();
    this.ui.hud.setScope(false);
    this.ui.hud.setVehicle(null);
    this.input.requestLock();
    this.audio.init().then(() => {
      if (this.world) this.audio.startAmbient(this.world.meta);
    });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.ui.hud.show();
    this.input.requestLock();
    this.audio.init();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.exitLock();
    this.ui.showPause();
  }

  quitToMenu() {
    this.showMenu();
  }

  restartMatch() {
    this.startMatch(this.mapId);
  }

  disposeMatch() {
    this.ui.hud.hide();
    this.ui.menus.hideAll();
    if (this.botDirector) {
      this.botDirector.clear();
      this.botDirector = null;
    }
    this.bots = [];
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    for (const p of this.projectiles) p.remove();
    this.projectiles = [];
    for (const p of this.pickups) p.dispose();
    this.pickups = [];
    if (this.effects) {
      this.effects.dispose();
      this.effects = null;
    }
    this.combat = null;
    this.capture = null;
    if (this.player) {
      this.player.inVehicle = null;
      this.player.dead = true;
      this.player.downed = false;
      this.player.destroyPhysics();
      if (this.player.viewmodel) this.player.viewmodel.setHidden(true);
    }
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    if (this.physicsWorld) {
      this.physicsWorld.free();
      this.physicsWorld = null;
    }
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    this.registry.clear();
    this.scene.fog = null;
    this.audio.stopAmbient();
    this.spotted.clear();
    this.roundActive = false;
    this.accumulator = 0;
    this.ui.hud.setScope(false);
    this.ui.hud.setVehicle(null);
  }

  updateDeployCamera(dt) {
    this.deployCamAngle += dt * 0.06;
    const r = 118;
    this.camera.position.set(Math.cos(this.deployCamAngle) * r, 58, Math.sin(this.deployCamAngle) * r);
    this.camera.lookAt(0, 2, 0);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
  }

  stepPhysics() {
    const step = GAME.fixedStep;
    if (this.state === 'playing' && this.player && !this.player.dead) this.player.updateMovement(step);
    if (this.botDirector) this.botDirector.updateMovement(step);
    for (const v of this.vehicles) v.updatePhysics(step);
    this.physicsWorld.step();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(step);
      if (p.dead) this.projectiles.splice(i, 1);
    }
  }

  updateShake(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const f = Math.max(0, this.shakeTime / 0.28);
      const amp = this.shakeAmount * f;
      this.shakeOffset.set(
        (Math.random() - 0.5) * amp,
        (Math.random() - 0.5) * amp,
        (Math.random() - 0.5) * amp
      );
      this.shakeRot.set((Math.random() - 0.5) * amp * 0.08, (Math.random() - 0.5) * amp * 0.08);
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeRot.set(0, 0);
      this.shakeAmount = 0;
    }
  }

  addShake(amount, position = null) {
    const dist = position ? this.camera.position.distanceTo(position) : 0;
    const scale = 1 / (1 + dist * 0.05);
    this.shakeAmount = Math.max(this.shakeAmount, amount * scale);
    this.shakeTime = 0.28;
  }

  applyTicketBleed() {
    let a = 0;
    let b = 0;
    for (const flag of this.world.flags) {
      if (flag.owner === 'A') a++;
      else if (flag.owner === 'B') b++;
    }
    if (a > b) this.tickets.B = Math.max(0, this.tickets.B - 1);
    else if (b > a) this.tickets.A = Math.max(0, this.tickets.A - 1);
  }

  update(dt) {
    this.time += dt;
    this.frame++;

    if (this.state === 'menu' || this.state === 'mapselect' || (this.state === 'loading' && !this.world)) {
      this.updateMenuScene(dt);
      return;
    }
    if (!this.world) {
      this.updateMenuScene(dt);
      return;
    }
    if (this.state === 'paused') {
      this.audio.updateListener(this.camera);
      return;
    }
    if (this.state === 'roundend') {
      this.updateDeployCamera(dt);
      this.audio.updateListener(this.camera);
      return;
    }

    if (this.state === 'playing' || this.state === 'deploy') {
      if (this.roundActive) {
        this.roundTimeLeft -= dt;
        if (this.roundTimeLeft <= 0) {
          this.roundTimeLeft = 0;
          if (this.checkRoundEnd()) return;
        }
        this.bleedTimer -= dt;
        if (this.bleedTimer <= 0) {
          this.bleedTimer = 2.5;
          this.applyTicketBleed();
          if (this.checkRoundEnd()) return;
        }

        if (this.state === 'playing' && this.player && !this.player.dead) this.player.update(dt);
        if (this.state === 'paused') return;

        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= GAME.fixedStep && steps < 4) {
          this.stepPhysics();
          this.accumulator -= GAME.fixedStep;
          steps++;
        }
        if (steps >= 4) this.accumulator = 0;

        if (this.state === 'playing' && this.player && !this.player.dead) this.player.updateCamera(dt);
        for (const v of this.vehicles) v.update(dt);
        if (this.botDirector) this.botDirector.update(dt);
        if (this.capture) this.capture.update(dt);
        for (const p of this.pickups) p.update(dt);
        this.pickups = this.pickups.filter((p) => !p.dead);
        if (this.effects) this.effects.update(dt);
        this.updateShake(dt);
        this.audio.update(dt);
        this.audio.updateListener(this.camera);

        if (this.state === 'playing') this.ui.hud.update(dt);

        if (this.state === 'deploy') {
          this.deployCountdown = Math.max(0, this.deployCountdown - dt);
          this.deployRefreshTimer -= dt;
          if (this.deployRefreshTimer <= 0) {
            this.deployRefreshTimer = 0.2;
            this.ui.refreshDeploy(this.getDeployData());
          }
          this.updateDeployCamera(dt);
        }

        this.cleanupSpotted();
        if (this.checkRoundEnd()) return;
      } else if (this.state === 'deploy') {
        this.updateDeployCamera(dt);
      }
    }
  }

  cleanupSpotted() {
    for (const [entity, until] of this.spotted) {
      if (until < this.time || !entity || entity.dead) this.spotted.delete(entity);
    }
  }

  render(dt) {
    if (this.state === 'menu' || this.state === 'mapselect' || this.state === 'loading' || !this.world) {
      this.postfx.setScene(this.menuScene, this.menuCamera);
      this.postfx.setDamage(0);
      this.postfx.render(dt);
      return;
    }
    this.postfx.setScene(this.scene, this.camera);
    this.postfx.setDamage(this.player ? this.player.damageFlash : 0);
    this.postfx.render(dt);
    const p = this.player;
    if (this.state === 'playing' && p && !p.dead && !p.downed && !p.inVehicle && p.viewmodel && !p.viewmodel.hidden) {
      p.viewmodel.render(this.renderer);
    }
  }

  loop(now) {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(Math.max(raw, 0.0001), 0.05);
    this.fps = this.fps * 0.9 + (1 / Math.max(raw, 0.001)) * 0.1;
    this.update(dt);
    this.render(dt);
    this.input.endFrame();
    requestAnimationFrame(this.loopBound);
  }

  checkRoundEnd() {
    if (!this.roundActive) return false;
    let winner = null;
    if (this.tickets.A <= 0) winner = 'B';
    else if (this.tickets.B <= 0) winner = 'A';
    else if (this.roundTimeLeft <= 0) {
      if (this.tickets.A > this.tickets.B) winner = 'A';
      else if (this.tickets.B > this.tickets.A) winner = 'B';
      else {
        const a = this.world.flags.filter((f) => f.owner === 'A').length;
        const b = this.world.flags.filter((f) => f.owner === 'B').length;
        winner = a >= b ? 'A' : 'B';
      }
    }
    if (!winner) return false;
    this.endRound(winner);
    return true;
  }

  endRound(winner) {
    if (this.state === 'roundend') return;
    this.state = 'roundend';
    this.roundActive = false;
    this.input.exitLock();
    this.audio.stopAmbient();
    const p = this.player;
    const stats = p
      ? { kills: p.kills, deaths: p.deaths, score: p.score, captures: p.captures }
      : { kills: 0, deaths: 0, score: 0, captures: 0 };
    this.ui.showRoundEnd({
      winner,
      playerTeam: this.playerTeam,
      map: this.world.meta,
      tickets: { ...this.tickets },
      stats
    });
    this.ui.hud.hide();
    this.deployCamAngle = 0;
  }

  onDowned(source, target) {
    if (!target || !target.name) return;
    const credit = source?.isVehicle ? source.driver : source;
    if (credit && credit !== target && credit.team !== target.team) {
      credit.kills = (credit.kills || 0) + 1;
      credit.score = (credit.score || 0) + 100;
    }
    let weapon = '爆炸';
    if (credit?.weapon?.def) weapon = credit.weapon.def.short;
    else if (source?.isVehicle) weapon = source.type === 'tank' ? '坦克' : '機槍';
    else if (!source) weapon = '環境';
    this.ui.hud.addKillFeed(credit?.name || '戰場', target.name, weapon);
    this.audio.playHit(true);
  }

  onBotDeath(bot, source) {
    this.tickets[bot.team] = Math.max(0, this.tickets[bot.team] - 1);
    bot.deaths++;
    if (this.botDirector) this.botDirector.scheduleRespawn(bot);
    this.checkRoundEnd();
  }

  onPlayerDeath(player, source) {
    this.tickets[player.team] = Math.max(0, this.tickets[player.team] - 1);
    player.deaths++;
    this.deployClass = player.classId;
    if (this.checkRoundEnd()) return;
    this.state = 'deploy';
    this.deployCountdown = GAME.respawnDelay;
    this.deployRefreshTimer = 0;
    this.ui.hud.hide();
    this.ui.showDeploy(this.getDeployData());
    this.input.exitLock();
    this.deployCamAngle = 0;
  }

  onVehicleDestroyed(vehicle, source) {
    const credit = source?.driver || source;
    if (credit && credit.team !== vehicle.team) {
      credit.score = (credit.score || 0) + 150;
    }
    this.ui.hud.addKillFeed(credit?.name || '戰場', vehicle.type === 'tank' ? '坦克' : '吉普車', '爆炸');
  }

  getSoldiers() {
    const out = [];
    if (this.player && !this.player.dead) out.push(this.player);
    for (const b of this.bots) if (!b.dead) out.push(b);
    return out;
  }

  getDamageables() {
    const out = this.getSoldiers();
    for (const v of this.vehicles) if (!v.destroyed) out.push(v);
    return out;
  }

  spawnProjectile(opts) {
    const p = new Projectile(this, opts);
    this.projectiles.push(p);
    return p;
  }

  spawnPickup(kind, pos, team = null) {
    const p = new Pickup(this, kind, pos, team);
    this.pickups.push(p);
    return p;
  }

  spotEnemies(team, pos, radius, duration) {
    for (const s of this.getSoldiers()) {
      if (s.team === team || s.downed || s.dead) continue;
      if (s.getCenter().distanceTo(pos) <= radius) {
        this.spotted.set(s, this.time + duration);
      }
    }
    for (const v of this.vehicles) {
      if (v.team === team || v.destroyed) continue;
      if (v.getCenter().distanceTo(pos) <= radius) {
        this.spotted.set(v, this.time + duration);
      }
    }
  }

  setSetting(key, value) {
    this.settings[key] = value;
    if (key === 'quality') this.applyQuality(value);
    if (key === 'brightness') this.renderer.toneMappingExposure = value;
    if (key === 'master' || key === 'sfx' || key === 'ambient') {
      this.audio.setVolumes({
        master: this.settings.master,
        sfx: this.settings.sfx,
        ambient: this.settings.ambient
      });
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // 無法寫入時忽略。
    }
  }

  applyQuality(q) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.postfx.setQuality(q, { w, h });
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.world?.dirLight) {
      const size = q === 'low' ? 1024 : q === 'high' ? 4096 : 2048;
      this.world.dirLight.shadow.mapSize.set(size, size);
      if (this.world.dirLight.shadow.map) {
        this.world.dirLight.shadow.map.dispose();
        this.world.dirLight.shadow.map = null;
      }
    }
    if (this.world?.weather) this.world.weather.setQuality(q);
    if (this.player?.viewmodel) this.player.viewmodel.resize(w, h);
  }
}
