import { MAPS } from '../config/maps.js';
import { CLASS_LIST, CLASSES } from '../config/classes.js';
import { WEAPONS, GADGETS } from '../config/weapons.js';
import { GAME } from '../config/game.js';

// 主選單、地圖選擇、部署、暫停、設定、操作說明、載入與回合結算。
const ICONS = {
  assault: `<svg viewBox="0 0 64 64"><path d="M6 34h22v-5h12v-4h10v4h10v6H40v4H6z" fill="currentColor"/><path d="M10 38h10v8H10z" fill="currentColor" opacity=".7"/></svg>`,
  medic: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 18v28M18 32h28" stroke="currentColor" stroke-width="6"/></svg>`,
  engineer: `<svg viewBox="0 0 64 64"><path d="M40 12a12 12 0 0 1 11 16l-7-4-4 7 8 4a12 12 0 0 1-20 1L12 48l-4-4 16-16a12 12 0 0 1 16-16z" fill="currentColor"/></svg>`,
  scout: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 8v14M32 42v14M8 32h14M42 32h14" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>`
};

const weatherLabel = { mist: '黎明薄霧', clear: '黃昏暖陽', rain: '陰雨藍灰' };

function drawMapPreview(canvas, meta) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, meta.sky.top);
  sky.addColorStop(0.7, meta.sky.horizon);
  sky.addColorStop(1, meta.sky.ground);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * (0.25 + (meta.seed % 17) / 40);
  const sunY = h * 0.45;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.55);
  sun.addColorStop(0, meta.sky.sun);
  sun.addColorStop(0.25, `${meta.sky.sun}88`);
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = meta.sky.ground;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.66);
  ctx.lineTo(w, h * 0.6);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const dark = '#171713';
  if (meta.id === 'ashen-valley') {
    ctx.fillStyle = '#2a241d';
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 38;
      const bh = 18 + (i % 3) * 8;
      ctx.fillRect(x, h * 0.62 - bh, 24, bh);
      ctx.fillRect(x + 8, h * 0.62 - bh - 10, 8, 12);
    }
    ctx.fillRect(w * 0.56, h * 0.32, 18, 54);
    ctx.fillRect(w * 0.56 + 4, h * 0.24, 10, 12);
    ctx.strokeStyle = '#2a241d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    ctx.lineTo(w, h * 0.82);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 70;
      const g = ctx.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, 28);
      g.addColorStop(0, 'rgba(160,150,135,0.35)');
      g.addColorStop(1, 'rgba(160,150,135,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 30, h * 0.2, 60, 70);
    }
  } else if (meta.id === 'dusk-ridge') {
    ctx.fillStyle = '#2a2019';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.lineTo(w * 0.35, h * 0.52);
    ctx.lineTo(w * 0.55, h * 0.45);
    ctx.lineTo(w * 0.75, h * 0.62);
    ctx.lineTo(w, h * 0.7);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2d22';
    ctx.fillRect(w * 0.45, h * 0.32, 52, 20);
    ctx.fillRect(w * 0.45, h * 0.28, 8, 10);
    ctx.fillRect(w * 0.64, h * 0.28, 8, 10);
    ctx.strokeStyle = '#1d1712';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.45 + i * 13, h * 0.34);
      ctx.lineTo(w * 0.45 + i * 13, h * 0.32);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a3a2c';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72 + i * 7);
      ctx.lineTo(w, h * 0.7 + i * 7);
      ctx.stroke();
    }
  } else {
    const river = ctx.createLinearGradient(0, h * 0.58, 0, h);
    river.addColorStop(0, '#3c5059');
    river.addColorStop(1, '#202b31');
    ctx.fillStyle = river;
    ctx.fillRect(w * 0.42, 0, w * 0.18, h);
    ctx.fillStyle = '#2b2620';
    ctx.fillRect(w * 0.18, h * 0.58, 42, 30);
    ctx.fillRect(w * 0.24, h * 0.48, 8, 18);
    ctx.fillRect(w * 0.7, h * 0.54, 40, 34);
    ctx.fillRect(w * 0.72, h * 0.46, 12, 16);
    ctx.fillStyle = '#4b4135';
    ctx.fillRect(w * 0.4, h * 0.6, w * 0.2, 5);
    ctx.fillStyle = '#2b2620';
    ctx.fillRect(w * 0.49, h * 0.63, 6, 12);
    ctx.strokeStyle = 'rgba(190,205,215,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const x = (i * 53) % w;
      const y = (i * 37) % (h * 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + 8);
      ctx.stroke();
    }
  }

  const fog = ctx.createLinearGradient(0, h * 0.35, 0, h);
  fog.addColorStop(0, 'rgba(120,110,95,0)');
  fog.addColorStop(1, meta.weather === 'rain' ? 'rgba(60,75,85,0.35)' : 'rgba(120,100,75,0.22)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);

  const half = meta.size / 2;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of meta.flags) {
    const x = ((f.pos[0] + half) / meta.size) * w;
    const y = ((f.pos[1] + half) / meta.size) * h;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,8,0.72)';
    ctx.fill();
    ctx.strokeStyle = '#e5dcc8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e5dcc8';
    ctx.fillText(f.id, x, y + 1);
  }

  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

export class Menus {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.currentDeploy = null;
    this.settingsReturn = 'menu';
    this.build();
  }

  build() {
    this.menuScreen = document.createElement('div');
    this.menuScreen.className = 'screen menu-screen';
    this.menuScreen.innerHTML = `
      <div class="menu-overlay"></div>
      <div class="menu-content">
        <div class="menu-eyebrow">第一次世界大戰 · 西線</div>
        <h1 class="game-title">鐵與泥 <span>1916</span></h1>
        <div class="game-subtitle">步兵、戰壕與鋼鐵的泥濘戰場</div>
        <div class="menu-buttons">
          <button class="btn primary" data-action="start">開始遊戲</button>
          <button class="btn" data-action="settings">設定</button>
          <button class="btn" data-action="controls">操作說明</button>
        </div>
        <div class="menu-footer">程序化 3D 戰場 · 16v16 征服模式 · 三張可選地圖</div>
      </div>
    `;
    this.root.appendChild(this.menuScreen);

    this.mapScreen = document.createElement('div');
    this.mapScreen.className = 'screen map-screen';
    this.mapScreen.innerHTML = `
      <div class="screen-header">
        <div>
          <div class="eyebrow">選擇戰場</div>
          <h2>三條戰線</h2>
        </div>
        <button class="btn small" data-action="back-menu">返回</button>
      </div>
      <div class="map-grid"></div>
    `;
    this.root.appendChild(this.mapScreen);

    this.deployScreen = document.createElement('div');
    this.deployScreen.className = 'screen deploy-screen';
    this.root.appendChild(this.deployScreen);

    this.pauseScreen = document.createElement('div');
    this.pauseScreen.className = 'screen modal-screen pause-screen';
    this.pauseScreen.innerHTML = `
      <div class="modal-panel">
        <h2>暫停</h2>
        <div class="modal-buttons">
          <button class="btn primary" data-action="resume">繼續作戰</button>
          <button class="btn" data-action="settings">設定</button>
          <button class="btn" data-action="controls">操作說明</button>
          <button class="btn danger" data-action="quit">離開戰場</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.pauseScreen);

    this.roundScreen = document.createElement('div');
    this.roundScreen.className = 'screen round-screen';
    this.root.appendChild(this.roundScreen);

    this.settingsModal = document.createElement('div');
    this.settingsModal.className = 'screen modal-screen settings-screen';
    this.root.appendChild(this.settingsModal);

    this.controlsModal = document.createElement('div');
    this.controlsModal.className = 'screen modal-screen controls-screen';
    this.controlsModal.innerHTML = `
      <div class="modal-panel wide">
        <h2>操作說明</h2>
        <div class="controls-grid">
          <div><kbd>W A S D</kbd><span>移動</span></div>
          <div><kbd>Shift</kbd><span>衝刺</span></div>
          <div><kbd>Ctrl</kbd><span>蹲下</span></div>
          <div><kbd>Space</kbd><span>跳躍</span></div>
          <div><kbd>左鍵</kbd><span>開火</span></div>
          <div><kbd>右鍵</kbd><span>瞄準 / 載具機槍</span></div>
          <div><kbd>R</kbd><span>換彈</span></div>
          <div><kbd>1 / 2</kbd><span>切換武器</span></div>
          <div><kbd>G</kbd><span>手榴彈 / 地雷</span></div>
          <div><kbd>F</kbd><span>兵種技能 / 維修</span></div>
          <div><kbd>E</kbd><span>互動 / 上下車 / 復活</span></div>
          <div><kbd>Tab</kbd><span>計分板</span></div>
          <div><kbd>Esc</kbd><span>暫停</span></div>
        </div>
        <div class="modal-hint">狙擊兵瞄準時按住 Shift 可閉氣穩定；醫療兵按住 E 復活倒地隊友。</div>
        <button class="btn" data-action="close-controls">關閉</button>
      </div>
    `;
    this.root.appendChild(this.controlsModal);

    this.loadingScreen = document.createElement('div');
    this.loadingScreen.className = 'screen loading-screen';
    this.loadingScreen.hidden = true;
    this.loadingScreen.innerHTML = `
      <div class="loading-panel">
        <div class="loading-title">正在部署戰場</div>
        <div class="loading-label">生成地形</div>
        <div class="loading-bar"><i></i></div>
        <div class="loading-spinner"></div>
      </div>
    `;
    this.root.appendChild(this.loadingScreen);

    this.bind();
  }

  click(fn) {
    return (e) => {
      e.preventDefault();
      this.game.audio.init();
      this.game.audio.playUIClick();
      fn();
    };
  }

  bind() {
    this.menuScreen.querySelector('[data-action="start"]').addEventListener('click', this.click(() => this.game.showMapSelect()));
    this.menuScreen.querySelector('[data-action="settings"]').addEventListener('click', this.click(() => this.showSettings('menu')));
    this.menuScreen.querySelector('[data-action="controls"]').addEventListener('click', this.click(() => this.showControls()));

    this.mapScreen.querySelector('[data-action="back-menu"]').addEventListener('click', this.click(() => this.game.showMenu()));

    this.pauseScreen.querySelector('[data-action="resume"]').addEventListener('click', this.click(() => this.game.resume()));
    this.pauseScreen.querySelector('[data-action="settings"]').addEventListener('click', this.click(() => this.showSettings('pause')));
    this.pauseScreen.querySelector('[data-action="controls"]').addEventListener('click', this.click(() => this.showControls()));
    this.pauseScreen.querySelector('[data-action="quit"]').addEventListener('click', this.click(() => this.game.quitToMenu()));

    this.controlsModal.querySelector('[data-action="close-controls"]').addEventListener('click', this.click(() => this.hideControls()));
  }

  renderMapCards() {
    const grid = this.mapScreen.querySelector('.map-grid');
    grid.innerHTML = '';
    for (const meta of MAPS) {
      const card = document.createElement('div');
      card.className = 'map-card';
      card.innerHTML = `
        <canvas width="340" height="180"></canvas>
        <div class="map-card-body">
          <div class="map-weather">${weatherLabel[meta.weather] || ''}</div>
          <h3>${meta.name}</h3>
          <div class="map-sub">${meta.subtitle}</div>
          <p>${meta.description}</p>
          <div class="map-flags">${meta.flags.map((f) => `<span>${f.id} ${f.name}</span>`).join('')}</div>
          <button class="btn primary" data-map="${meta.id}">部署到此地圖</button>
        </div>
      `;
      drawMapPreview(card.querySelector('canvas'), meta);
      card.querySelector('button').addEventListener('click', this.click(() => this.game.startMatch(meta.id)));
      grid.appendChild(card);
    }
  }

  showMenu() {
    this.hideAll();
    this.menuScreen.hidden = false;
  }

  showMapSelect() {
    this.hideAll();
    this.renderMapCards();
    this.mapScreen.hidden = false;
  }

  getDeployData() {
    return this.currentDeploy;
  }

  showDeploy(data) {
    this.currentDeploy = data;
    this.hideAll();
    this.deployScreen.hidden = false;
    this.refreshDeploy();
  }

  refreshDeploy() {
    const data = this.currentDeploy;
    if (!data) return;
    const map = data.map;
    const selectedClass = data.selectedClass;
    const selectedSpawn = data.selectedSpawn;
    const countdown = Math.max(0, Math.ceil(data.countdown || 0));
    const canDeploy = countdown <= 0;
    const classes = CLASS_LIST.map((id) => {
      const c = CLASSES[id];
      const weapon = WEAPONS[c.primary];
      const pips = Object.entries(c.stats).map(([label, value]) => `
        <div class="stat-row"><span>${label}</span><div class="pips">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= value ? 'on' : ''}"></i>`).join('')}</div></div>
      `).join('');
      return `
        <div class="class-card ${id === selectedClass ? 'selected' : ''}" data-class="${id}" style="--class-color:${c.color}">
          <div class="class-icon">${ICONS[c.icon]}</div>
          <div class="class-title">${c.name}</div>
          <div class="class-role">${c.role}</div>
          <div class="class-weapon">${weapon.name}</div>
          <div class="class-stats">${pips}</div>
        </div>`;
    }).join('');

    const spawns = (data.spawns || []).map((s) => `
      <button class="spawn-btn ${s.id === selectedSpawn ? 'selected' : ''}" data-spawn="${s.id}">
        <span class="spawn-id">${s.kind === 'hq' ? 'HQ' : s.id}</span>
        <span class="spawn-name">${s.name}</span>
      </button>
    `).join('');

    const stats = data.stats || { kills: 0, deaths: 0, score: 0 };
    this.deployScreen.innerHTML = `
      <div class="deploy-top">
        <div>
          <div class="eyebrow">${weatherLabel[map.weather] || ''}</div>
          <h2>${map.name}</h2>
          <div class="deploy-sub">${map.subtitle}</div>
        </div>
        <div class="deploy-stats">
          <span>擊殺 ${stats.kills}</span>
          <span>死亡 ${stats.deaths}</span>
          <span>分數 ${stats.score}</span>
        </div>
      </div>
      <div class="deploy-body">
        <div class="class-grid">${classes}</div>
        <div class="deploy-side">
          <div class="side-block">
            <div class="side-title">出生點</div>
            <div class="spawn-list">${spawns}</div>
          </div>
          <div class="side-block">
            <div class="side-title">戰場情報</div>
            <div class="intel">票數 ${GAME.tickets} · 16v16 · 三旗點</div>
            <div class="intel">${map.description}</div>
          </div>
          <button class="btn primary deploy-btn" ${canDeploy ? '' : 'disabled'}>
            ${canDeploy ? '部署' : `等待 ${countdown} 秒`}
          </button>
          <button class="btn small" data-action="leave">離開戰場</button>
        </div>
      </div>
    `;

    this.deployScreen.querySelectorAll('[data-class]').forEach((el) => {
      el.addEventListener('click', this.click(() => {
        this.game.setDeployClass(el.dataset.class);
        this.currentDeploy = this.game.getDeployData();
        this.refreshDeploy();
      }));
    });
    this.deployScreen.querySelectorAll('[data-spawn]').forEach((el) => {
      el.addEventListener('click', this.click(() => {
        this.game.setDeploySpawn(el.dataset.spawn);
        this.currentDeploy = this.game.getDeployData();
        this.refreshDeploy();
      }));
    });
    this.deployScreen.querySelector('.deploy-btn').addEventListener('click', this.click(() => {
      if (canDeploy) this.game.deploy();
    }));
    this.deployScreen.querySelector('[data-action="leave"]').addEventListener('click', this.click(() => this.game.quitToMenu()));
  }

  hideDeploy() {
    this.deployScreen.hidden = true;
  }

  showPause() {
    this.pauseScreen.hidden = false;
  }

  hidePause() {
    this.pauseScreen.hidden = true;
  }

  showRoundEnd(data) {
    this.hideAll();
    this.roundScreen.hidden = false;
    const result = data.winner === data.playerTeam ? '勝利' : '戰敗';
    this.roundScreen.innerHTML = `
      <div class="round-panel">
        <div class="round-result ${data.winner === data.playerTeam ? 'win' : 'lose'}">${result}</div>
        <div class="round-map">${data.map.name}</div>
        <div class="round-tickets">協約 ${data.tickets.A} · 同盟 ${data.tickets.B}</div>
        <div class="round-stats">
          <div><span>擊殺</span><strong>${data.stats.kills}</strong></div>
          <div><span>死亡</span><strong>${data.stats.deaths}</strong></div>
          <div><span>分數</span><strong>${data.stats.score}</strong></div>
          <div><span>佔領</span><strong>${data.stats.captures}</strong></div>
        </div>
        <div class="round-buttons">
          <button class="btn primary" data-action="replay">再來一局</button>
          <button class="btn" data-action="maps">換地圖</button>
          <button class="btn" data-action="menu">主選單</button>
        </div>
      </div>
    `;
    this.roundScreen.querySelector('[data-action="replay"]').addEventListener('click', this.click(() => this.game.restartMatch()));
    this.roundScreen.querySelector('[data-action="maps"]').addEventListener('click', this.click(() => this.game.showMapSelect()));
    this.roundScreen.querySelector('[data-action="menu"]').addEventListener('click', this.click(() => this.game.showMenu()));
  }

  showLoading(label, progress) {
    this.loadingScreen.hidden = false;
    this.loadingScreen.querySelector('.loading-label').textContent = label || '載入中';
    this.loadingScreen.querySelector('.loading-bar i').style.width = `${Math.round((progress || 0) * 100)}%`;
  }

  hideLoading() {
    this.loadingScreen.hidden = true;
  }

  showSettings(returnTo = 'menu') {
    this.settingsReturn = returnTo;
    const s = this.game.settings;
    this.settingsModal.hidden = false;
    this.settingsModal.innerHTML = `
      <div class="modal-panel wide">
        <h2>設定</h2>
        <div class="settings-grid">
          <label>滑鼠靈敏度 <span class="setting-value" data-value="sensitivity">${s.sensitivity.toFixed(4)}</span>
            <input type="range" min="0.0005" max="0.006" step="0.0001" value="${s.sensitivity}" data-setting="sensitivity">
          </label>
          <label>視野 FOV <span class="setting-value" data-value="fov">${s.fov}</span>
            <input type="range" min="65" max="110" step="1" value="${s.fov}" data-setting="fov">
          </label>
          <label>亮度 <span class="setting-value" data-value="brightness">${(s.brightness ?? 1.4).toFixed(2)}</span>
            <input type="range" min="0.7" max="1.8" step="0.05" value="${s.brightness ?? 1.4}" data-setting="brightness">
          </label>
          <label>畫質
            <select data-setting="quality">
              <option value="low" ${s.quality === 'low' ? 'selected' : ''}>低</option>
              <option value="medium" ${s.quality === 'medium' ? 'selected' : ''}>中</option>
              <option value="high" ${s.quality === 'high' ? 'selected' : ''}>高</option>
            </select>
          </label>
          <label>主音量 <span class="setting-value" data-value="master">${Math.round(s.master * 100)}</span>
            <input type="range" min="0" max="1" step="0.05" value="${s.master}" data-setting="master">
          </label>
          <label>音效 <span class="setting-value" data-value="sfx">${Math.round(s.sfx * 100)}</span>
            <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-setting="sfx">
          </label>
          <label>環境音 <span class="setting-value" data-value="ambient">${Math.round(s.ambient * 100)}</span>
            <input type="range" min="0" max="1" step="0.05" value="${s.ambient}" data-setting="ambient">
          </label>
          <label class="checkbox"><input type="checkbox" data-setting="invertY" ${s.invertY ? 'checked' : ''}> 反轉滑鼠 Y 軸</label>
          <label class="checkbox"><input type="checkbox" data-setting="showFps" ${s.showFps ? 'checked' : ''}> 顯示 FPS</label>
        </div>
        <button class="btn" data-action="close-settings">關閉</button>
      </div>
    `;
    this.settingsModal.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting;
        let value;
        if (input.type === 'checkbox') value = input.checked;
        else if (input.tagName === 'SELECT') value = input.value;
        else value = parseFloat(input.value);
        this.game.setSetting(key, value);
        const label = this.settingsModal.querySelector(`[data-value="${key}"]`);
        if (label) {
          if (key === 'sensitivity') label.textContent = value.toFixed(4);
          else if (key === 'fov') label.textContent = value;
          else if (key === 'brightness') label.textContent = value.toFixed(2);
          else if (key === 'master' || key === 'sfx' || key === 'ambient') label.textContent = Math.round(value * 100);
        }
      });
    });
    this.settingsModal.querySelector('[data-action="close-settings"]').addEventListener('click', this.click(() => this.hideSettings()));
  }

  hideSettings() {
    this.settingsModal.hidden = true;
    if (this.settingsReturn === 'pause') this.showPause();
    else this.showMenu();
  }

  showControls() {
    this.controlsModal.hidden = false;
  }

  hideControls() {
    this.controlsModal.hidden = true;
    if (this.game.state === 'paused') this.showPause();
  }

  hideAll() {
    for (const el of [this.menuScreen, this.mapScreen, this.deployScreen, this.pauseScreen, this.roundScreen, this.settingsModal, this.controlsModal]) {
      el.hidden = true;
    }
  }
}
