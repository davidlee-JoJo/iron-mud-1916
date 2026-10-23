import * as THREE from 'three';
import { GAME } from '../config/game.js';
import { CLASSES } from '../config/classes.js';
import { GADGETS, WEAPONS } from '../config/weapons.js';
import { Minimap } from './Minimap.js';

// 遊戲內 HUD：生命、彈藥、旗點、小地圖、標記、擊殺訊息、載具與計分板。
export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.hidden = true;
    root.appendChild(this.root);
    this.player = null;
    this.vehicle = null;
    this.scope = false;
    this.prompt = null;
    this.hitmarkerTimer = 0;
    this.killfeed = [];
    this.minimapTimer = 0;
    this.scoreboardTimer = 0;
    this.spottedPool = [];
    this.markers = [];
    this.build();
    this.minimap = new Minimap(this.minimapCanvas, game);
  }

  build() {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="tickets team-a"><span class="t-name">協約國</span><span class="t-num" data-ticket="A">300</span></div>
        <div class="flags-bar"></div>
        <div class="tickets team-b"><span class="t-name">同盟國</span><span class="t-num" data-ticket="B">300</span></div>
      </div>
      <div class="round-timer">15:00</div>
      <div class="minimap-wrap">
        <canvas class="minimap" width="180" height="180"></canvas>
        <div class="minimap-label">戰場</div>
        <div class="fps"></div>
      </div>
      <div class="killfeed"></div>
      <div class="crosshair">
        <div class="ch-line top"></div>
        <div class="ch-line bottom"></div>
        <div class="ch-line left"></div>
        <div class="ch-line right"></div>
        <div class="ch-dot"></div>
      </div>
      <div class="hud-left">
        <div class="class-badge"><span class="class-name">突擊兵</span></div>
        <div class="health-wrap">
          <div class="health-bar"><div class="health-fill"></div></div>
          <div class="health-text">100</div>
        </div>
        <div class="ability"><span class="ability-name">反載具手榴彈</span><span class="ability-count">1</span></div>
      </div>
      <div class="hud-right">
        <div class="weapon-name">MP18</div>
        <div class="ammo"><span class="ammo-mag">32</span><span class="ammo-sep">/</span><span class="ammo-reserve">160</span></div>
        <div class="grenade-info">手榴彈 <span class="grenade-count">2</span></div>
      </div>
      <div class="prompt" hidden></div>
      <div class="vehicle-hud" hidden>
        <div class="vh-title">載具</div>
        <div class="vh-hp"><div class="vh-hp-fill"></div></div>
        <div class="vh-row"><span class="vh-speed">0</span><span class="vh-reload">主砲就緒</span></div>
      </div>
      <div class="objective-markers"></div>
      <div class="spotted-markers"></div>
      <div class="damage-vignette"></div>
      <div class="hitmarker"><span></span><span></span><span></span><span></span></div>
      <div class="scope-overlay">
        <div class="scope-reticle"></div>
        <div class="scope-ring"></div>
      </div>
      <div class="downed-overlay" hidden>
        <div class="downed-title">倒地</div>
        <div class="downed-sub">等待醫療兵復活</div>
        <div class="downed-timer">20</div>
      </div>
      <div class="scoreboard" hidden></div>
      <div class="capture-toast" hidden></div>
    `;

    this.minimapCanvas = this.root.querySelector('.minimap');
    this.flagsBar = this.root.querySelector('.flags-bar');
    this.crosshair = this.root.querySelector('.crosshair');
    this.healthFill = this.root.querySelector('.health-fill');
    this.healthText = this.root.querySelector('.health-text');
    this.classNameEl = this.root.querySelector('.class-name');
    this.classBadge = this.root.querySelector('.class-badge');
    this.abilityName = this.root.querySelector('.ability-name');
    this.abilityCount = this.root.querySelector('.ability-count');
    this.weaponName = this.root.querySelector('.weapon-name');
    this.ammoMag = this.root.querySelector('.ammo-mag');
    this.ammoReserve = this.root.querySelector('.ammo-reserve');
    this.grenadeCount = this.root.querySelector('.grenade-count');
    this.promptEl = this.root.querySelector('.prompt');
    this.vehicleHud = this.root.querySelector('.vehicle-hud');
    this.vhTitle = this.root.querySelector('.vh-title');
    this.vhHp = this.root.querySelector('.vh-hp-fill');
    this.vhSpeed = this.root.querySelector('.vh-speed');
    this.vhReload = this.root.querySelector('.vh-reload');
    this.objectiveContainer = this.root.querySelector('.objective-markers');
    this.spottedContainer = this.root.querySelector('.spotted-markers');
    this.damageVignette = this.root.querySelector('.damage-vignette');
    this.hitmarkerEl = this.root.querySelector('.hitmarker');
    this.scopeOverlay = this.root.querySelector('.scope-overlay');
    this.downedOverlay = this.root.querySelector('.downed-overlay');
    this.downedTimer = this.root.querySelector('.downed-timer');
    this.scoreboard = this.root.querySelector('.scoreboard');
    this.killfeedEl = this.root.querySelector('.killfeed');
    this.roundTimer = this.root.querySelector('.round-timer');
    this.ticketA = this.root.querySelector('[data-ticket="A"]');
    this.ticketB = this.root.querySelector('[data-ticket="B"]');
    this.minimapLabel = this.root.querySelector('.minimap-label');
    this.fpsEl = this.root.querySelector('.fps');
    this.captureToast = this.root.querySelector('.capture-toast');
    this.captureToastTimer = 0;

    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'spotted-marker';
      el.hidden = true;
      this.spottedContainer.appendChild(el);
      this.spottedPool.push(el);
    }
  }

  setPlayer(player) {
    this.player = player;
  }

  setupWorld() {
    const world = this.game.world;
    if (!world) return;
    this.flagsBar.innerHTML = '';
    this.objectiveContainer.innerHTML = '';
    this.markers = [];
    for (const flag of world.flags) {
      const item = document.createElement('div');
      item.className = 'flag-item';
      item.innerHTML = `<span class="flag-letter">${flag.id}</span><span class="flag-progress"><i></i></span>`;
      this.flagsBar.appendChild(item);
      flag.hudItem = item;

      const marker = document.createElement('div');
      marker.className = 'objective-marker';
      marker.innerHTML = `<span class="marker-letter">${flag.id}</span><span class="marker-dist"></span>`;
      this.objectiveContainer.appendChild(marker);
      this.markers.push({ flag, el: marker, distEl: marker.querySelector('.marker-dist') });
    }
    this.minimapLabel.textContent = world.meta.name;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
    this.setScope(false);
    this.showScoreboard(false);
    this.setPrompt(null);
    this.setVehicle(null);
    this.hideDowned();
    this.scopeOverlay.classList.remove('visible');
  }

  setScope(v) {
    if (this.scope === v) return;
    this.scope = v;
    this.scopeOverlay.classList.toggle('visible', v);
    this.crosshair.classList.toggle('hidden', v);
  }

  setPrompt(text) {
    if (this.prompt === text) return;
    this.prompt = text;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.hidden = false;
    } else {
      this.promptEl.hidden = true;
    }
  }

  setVehicle(v) {
    this.vehicle = v;
    this.vehicleHud.hidden = !v;
    if (v) {
      this.vhTitle.textContent = v.type === 'tank' ? 'Mark V 坦克' : '偵察吉普';
    }
  }

  hitmarker(kill = false) {
    this.hitmarkerEl.classList.add('show');
    this.hitmarkerEl.classList.toggle('kill', kill);
    this.hitmarkerTimer = 0.14;
  }

  showDowned() {
    this.downedOverlay.hidden = false;
  }

  hideDowned() {
    this.downedOverlay.hidden = true;
  }

  setDownedTimer(t) {
    this.downedTimer.textContent = Math.max(0, Math.ceil(t));
  }

  addKillFeed(killer, victim, weapon) {
    const el = document.createElement('div');
    el.className = 'kill-entry';
    const teamA = GAME.teams.A.color;
    const teamB = GAME.teams.B.color;
    el.innerHTML = `<span class="killer">${killer}</span><span class="weapon">[${weapon}]</span><span class="victim">${victim}</span>`;
    el.style.setProperty('--killer-color', teamA);
    el.style.setProperty('--victim-color', teamB);
    this.killfeedEl.appendChild(el);
    this.killfeed.push({ el, timer: 6 });
    while (this.killfeed.length > 6) {
      const old = this.killfeed.shift();
      old.el.remove();
    }
  }

  toast(text) {
    this.captureToast.textContent = text;
    this.captureToast.hidden = false;
    this.captureToastTimer = 3;
  }

  showScoreboard(v) {
    this.scoreboard.hidden = !v;
  }

  buildScoreboard() {
    const player = this.player;
    const bots = this.game.bots;
    const rows = { A: [], B: [] };
    if (player) {
      rows[player.team].push({
        name: player.name,
        classId: player.classId,
        kills: player.kills,
        deaths: player.deaths,
        score: player.score,
        me: true
      });
    }
    for (const b of bots) {
      rows[b.team].push({
        name: b.name,
        classId: b.classId,
        kills: b.kills,
        deaths: b.deaths,
        score: b.score,
        me: false
      });
    }
    for (const team of ['A', 'B']) {
      rows[team].sort((a, b) => b.score - a.score);
    }
    const table = (team) => {
      const t = GAME.teams[team];
      const list = rows[team].map((r) => `
        <tr class="${r.me ? 'me' : ''}">
          <td class="sb-name">${r.name}</td>
          <td>${GAME.classNames[r.classId] || ''}</td>
          <td>${r.kills}</td>
          <td>${r.deaths}</td>
          <td>${r.score}</td>
        </tr>`).join('');
      return `
        <div class="sb-team" style="--team-color:${t.color}">
          <div class="sb-header"><span>${t.name}</span><span>${this.game.tickets[team]} 票</span></div>
          <table>
            <thead><tr><th>士兵</th><th>兵種</th><th>擊殺</th><th>死亡</th><th>分數</th></tr></thead>
            <tbody>${list}</tbody>
          </table>
        </div>`;
    };
    this.scoreboard.innerHTML = `<div class="sb-title">戰況</div><div class="sb-columns">${table('A')}${table('B')}</div>`;
  }

  update(dt) {
    const p = this.player;
    if (!p) return;
    const world = this.game.world;
    if (!world) return;

    const hp = Math.max(0, Math.ceil(p.health));
    this.healthText.textContent = hp;
    this.healthFill.style.width = `${(p.health / p.maxHealth) * 100}%`;
    this.healthFill.classList.toggle('low', p.health < 35);

    const c = CLASSES[p.classId];
    this.classNameEl.textContent = c?.name || '';
    this.classBadge.style.setProperty('--class-color', c?.color || '#d6a15a');
    const ability = c?.ability;
    this.abilityName.textContent = ability === 'repair' ? '維修扳手' : (GADGETS[ability]?.name || '');
    this.abilityCount.textContent = ability === 'repair' ? '按住 F' : String(p.abilityCount);

    const w = p.weapon;
    if (w) {
      this.weaponName.textContent = w.def.name;
      this.ammoMag.textContent = w.ammo;
      this.ammoReserve.textContent = w.reserve;
      this.ammoMag.classList.toggle('empty', w.ammo === 0);
      const gap = 6 + w.spread * 320 + (p.adsT > 0.5 ? -2 : 0);
      this.crosshair.style.setProperty('--gap', `${Math.max(3, gap)}px`);
    }
    this.grenadeCount.textContent = p.grenadeCount;

    if (p.inVehicle) {
      const v = p.inVehicle;
      this.vhHp.style.width = `${(v.hp / v.maxHp) * 100}%`;
      const speed = v.body ? Math.hypot(v.body.linvel().x, v.body.linvel().z) : 0;
      this.vhSpeed.textContent = `${Math.round(speed * 3.6)} km/h`;
      this.vhReload.textContent = v.type === 'tank'
        ? (v.cannonReload > 0 ? `主砲裝填 ${v.cannonReload.toFixed(1)}s` : '主砲就緒')
        : '機槍就緒';
      this.crosshair.classList.add('vehicle');
    } else {
      this.crosshair.classList.remove('vehicle');
    }

    this.ticketA.textContent = this.game.tickets.A;
    this.ticketB.textContent = this.game.tickets.B;
    this.roundTimer.textContent = this.formatTime(this.game.roundTimeLeft);
    this.updateFlags(world);
    this.updateMarkers(world);

    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.1;
      this.minimap.draw();
    }

    for (let i = this.killfeed.length - 1; i >= 0; i--) {
      const k = this.killfeed[i];
      k.timer -= dt;
      if (k.timer <= 0) {
        k.el.remove();
        this.killfeed.splice(i, 1);
      }
    }

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.hitmarkerEl.classList.remove('show', 'kill');
    }

    const dmg = Math.min(0.95, p.damageFlash * 0.8 + (p.health < 30 ? 0.18 : 0));
    this.damageVignette.style.opacity = dmg.toFixed(2);

    if (p.downed) {
      this.downedOverlay.hidden = false;
      this.setDownedTimer(p.bleedout);
    }

    this.fpsEl.textContent = `${Math.round(this.game.fps)} fps`;
    this.fpsEl.style.display = this.game.settings.showFps ? 'block' : 'none';

    if (this.captureToastTimer > 0) {
      this.captureToastTimer -= dt;
      if (this.captureToastTimer <= 0) this.captureToast.hidden = true;
    }

    const tab = this.game.input.isDown('Tab');
    this.scoreboard.hidden = !tab;
    if (tab) {
      this.scoreboardTimer -= dt;
      if (this.scoreboardTimer <= 0) {
        this.scoreboardTimer = 0.5;
        this.buildScoreboard();
      }
    }
  }

  updateFlags(world) {
    for (const flag of world.flags) {
      const item = flag.hudItem;
      if (!item) continue;
      const color = flag.owner ? GAME.teams[flag.owner].color : '#cfc7b5';
      item.style.setProperty('--flag-color', color);
      const fill = item.querySelector('.flag-progress i');
      let pct = flag.owner ? 100 : Math.round((flag.progress || 0) * 100);
      if (flag.capturingTeam) {
        fill.style.background = GAME.teams[flag.capturingTeam].color;
      } else {
        fill.style.background = color;
      }
      fill.style.width = `${pct}%`;
    }
  }

  updateMarkers(world) {
    const camera = this.game.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const player = this.player;
    const p = new THREE.Vector3();

    for (const m of this.markers) {
      const flag = m.flag;
      p.copy(flag.pos);
      p.y += 7.5;
      const dist = player.position.distanceTo(flag.pos);
      const v = p.clone().project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) {
        m.el.hidden = true;
        continue;
      }
      m.el.hidden = false;
      m.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      m.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      m.el.style.setProperty('--marker-color', flag.owner ? GAME.teams[flag.owner].color : '#d9d2c0');
      m.distEl.textContent = `${Math.round(dist)}m`;
    }

    let slot = 0;
    if (this.game.spotted) {
      for (const [entity, until] of this.game.spotted) {
        if (slot >= this.spottedPool.length) break;
        if (until < this.game.time || !entity || entity.dead || entity.downed) continue;
        const el = this.spottedPool[slot++];
        p.copy(entity.getCenter());
        p.y += 1.2;
        const v = p.clone().project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
          el.hidden = true;
          continue;
        }
        el.hidden = false;
        el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
        el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
        el.textContent = '◆';
      }
    }
    for (let i = slot; i < this.spottedPool.length; i++) this.spottedPool[i].hidden = true;
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
}
