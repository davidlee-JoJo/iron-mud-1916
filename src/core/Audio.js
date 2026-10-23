import * as THREE from 'three';

// 程序化音效：不載入任何音檔，全部用 Web Audio 即時合成。
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.compressor = null;
    this.reverb = null;
    this.noiseBuffer = null;
    this.ambientNodes = [];
    this.artilleryTimer = 8;
    this.thunderTimer = -1;
    this.enabled = false;
    this.mapMeta = null;
    this.volumes = { master: 0.8, sfx: 0.8, ambient: 0.5 };
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.master.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.connect(this.master);

    this.noiseBuffer = this.makeNoiseBuffer(2.2);
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4);
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.35;
    this.reverb.connect(reverbGain);
    reverbGain.connect(this.master);

    this.enabled = true;
    this.applyVolumes();
  }

  makeNoiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    return buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.ambientGain.gain.value = this.volumes.ambient;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  setPosition(node, pos) {
    if (!node || !pos) return;
    if (node.positionX) {
      node.positionX.value = pos.x;
      node.positionY.value = pos.y;
      node.positionZ.value = pos.z;
    } else if (node.setPosition) {
      node.setPosition(pos.x, pos.y, pos.z);
    }
  }

  makeOutput(pos, scale = 1, wet = 0) {
    const ctx = this.ctx;
    if (pos) {
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 7;
      panner.maxDistance = 260;
      panner.rolloffFactor = 1.25;
      this.setPosition(panner, pos);
      const gain = ctx.createGain();
      gain.gain.value = scale;
      panner.connect(gain);
      gain.connect(this.sfxGain);
      if (wet > 0) {
        const send = ctx.createGain();
        send.gain.value = wet;
        gain.connect(send);
        send.connect(this.reverb);
      }
      return panner;
    }
    const gain = ctx.createGain();
    gain.gain.value = scale;
    gain.connect(this.sfxGain);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      gain.connect(send);
      send.connect(this.reverb);
    }
    return gain;
  }

  updateListener(camera) {
    if (!this.ctx || !camera) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const up = camera.up;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
      l.forwardX.value = dir.x;
      l.forwardY.value = dir.y;
      l.forwardZ.value = dir.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(dir.x, dir.y, dir.z, up.x, up.y, up.z);
    }
  }

  playGun(type, pos = null, isPlayer = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const cfg = {
      smg: { freq: 1900, dur: 0.11, vol: 0.32, sub: 95 },
      semi: { freq: 1500, dur: 0.16, vol: 0.4, sub: 85 },
      lmg: { freq: 1250, dur: 0.18, vol: 0.45, sub: 75 },
      bolt: { freq: 1050, dur: 0.34, vol: 0.6, sub: 62 },
      pistol: { freq: 2100, dur: 0.1, vol: 0.28, sub: 110 },
      tankmg: { freq: 900, dur: 0.2, vol: 0.55, sub: 70 },
      cannon: { freq: 500, dur: 0.6, vol: 0.9, sub: 45 }
    }[type] || { freq: 1600, dur: 0.12, vol: 0.3, sub: 90 };

    const out = this.makeOutput(pos, isPlayer ? 0.7 : 1, type === 'bolt' || type === 'cannon' ? 0.3 : 0.08);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = cfg.freq;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(cfg.vol, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur);
    noise.connect(bp);
    bp.connect(g);
    g.connect(out);
    noise.start(now);
    noise.stop(now + cfg.dur + 0.05);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(cfg.sub * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(cfg.sub * 0.7, now + cfg.dur * 0.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(cfg.vol * 0.7, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + cfg.dur * 0.9);
    osc.connect(og);
    og.connect(out);
    osc.start(now);
    osc.stop(now + cfg.dur + 0.05);
  }

  playExplosion(pos, size = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(pos, Math.min(1.4, size), 0.5);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 * size, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3 * size);
    noise.connect(lp);
    lp.connect(g);
    g.connect(out);
    noise.start(now);
    noise.stop(now + 1.4 * size);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.8, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    osc.connect(og);
    og.connect(out);
    osc.start(now);
    osc.stop(now + 1.1);
  }

  playReload(isPlayer = true) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, isPlayer ? 0.5 : 0.25);
    for (let i = 0; i < 2; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400 + i * 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, now + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.08);
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start(now + i * 0.16);
      src.stop(now + i * 0.16 + 0.1);
    }
  }

  playBolt(isPlayer = true) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, isPlayer ? 0.5 : 0.25);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(now);
    src.stop(now + 0.12);
  }

  playFootstep(surface = 'mud', pos = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = surface === 'wood' ? 900 : surface === 'stone' ? 1500 : surface === 'water' ? 700 : 420;
    const out = this.makeOutput(pos, pos ? 0.5 : 0.28);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    src.start(now);
    src.stop(now + 0.09);
  }

  playHit(kill = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, 0.35);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(kill ? 620 : 1100, now);
    osc.frequency.exponentialRampToValueAtTime(kill ? 980 : 1500, now + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playUIClick() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, 0.25);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 660;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playCapture() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, 0.4);
    [440, 554, 659].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.4);
      osc.connect(g);
      g.connect(out);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.45);
    });
  }

  playSpawn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.makeOutput(null, 0.4);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playThunder(delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + Math.max(0, delay);
    const out = this.makeOutput(null, 0.7, 0.8);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.5, start + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    src.start(start);
    src.stop(start + 2.4);
  }

  startAmbient(meta) {
    this.stopAmbient();
    if (!this.ctx) return;
    this.mapMeta = meta;
    const ctx = this.ctx;

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = meta.weather === 'rain' ? 0.09 : 0.055;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    wind.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    this.ambientNodes.push(wind, lfo);

    if (meta.weather === 'rain') {
      const rain = ctx.createBufferSource();
      rain.buffer = this.noiseBuffer;
      rain.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200;
      const rg = ctx.createGain();
      rg.gain.value = 0.055;
      rain.connect(hp);
      hp.connect(rg);
      rg.connect(this.ambientGain);
      rain.start();
      this.ambientNodes.push(rain);
    }

    this.artilleryTimer = 6 + Math.random() * 8;
    this.thunderTimer = meta.weather === 'rain' ? 6 + Math.random() * 10 : -1;
  }

  stopAmbient() {
    for (const node of this.ambientNodes) {
      try {
        node.stop();
      } catch {
        // 節點可能已停止。
      }
    }
    this.ambientNodes = [];
    this.mapMeta = null;
  }

  update(dt) {
    if (!this.ctx || !this.mapMeta) return;
    this.artilleryTimer -= dt;
    if (this.artilleryTimer <= 0) {
      this.artilleryTimer = 7 + Math.random() * 14;
      const side = Math.random() < 0.5 ? -1 : 1;
      const pos = { x: side * 240, y: 2, z: (Math.random() - 0.5) * 260 };
      this.playExplosion(pos, 0.55);
      if (this.onDistantArtillery) this.onDistantArtillery(pos);
    }
    if (this.thunderTimer > 0) {
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 9 + Math.random() * 14;
        this.playThunder(0.2 + Math.random() * 0.8);
        if (this.onLightning) this.onLightning();
      }
    }
  }

  createEngine(pos) {
    if (!this.ctx) return { update() {}, stop() {}, setPosition() {} };
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 10;
    panner.maxDistance = 160;
    panner.rolloffFactor = 1.1;
    this.setPosition(panner, pos);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 45;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);
    osc1.start();
    osc2.start();

    return {
      update: (speed, p) => {
        const s = clamp(Math.abs(speed), 0, 20);
        const f = 38 + s * 5.5;
        osc1.frequency.setTargetAtTime(f, ctx.currentTime, 0.12);
        osc2.frequency.setTargetAtTime(f * 2.02, ctx.currentTime, 0.12);
        lp.frequency.setTargetAtTime(360 + s * 34, ctx.currentTime, 0.12);
        gain.gain.setTargetAtTime(0.025 + s * 0.002, ctx.currentTime, 0.2);
        if (p) this.setPosition(panner, p);
      },
      stop: () => {
        try {
          osc1.stop();
          osc2.stop();
        } catch {
          // 已停止。
        }
        gain.disconnect();
        panner.disconnect();
      }
    };
  }
}
