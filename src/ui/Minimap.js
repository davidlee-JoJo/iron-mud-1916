import { GAME } from '../config/game.js';

// 小地圖：地形縮圖、旗點、隊友、已標記敵人與載具。
export class Minimap {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.size = canvas.width;
    this.timer = 0;
  }

  worldToMap(x, z) {
    const half = this.game.world.meta.size / 2;
    const s = this.size;
    return {
      x: (x + half) / this.game.world.meta.size * s,
      y: (z + half) / this.game.world.meta.size * s
    };
  }

  draw() {
    if (!this.game.world || !this.game.world.minimapCanvas) return;
    const ctx = this.ctx;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.game.world.minimapCanvas, 0, 0, s, s);

    const player = this.game.player;
    for (const flag of this.game.world.flags) {
      const p = this.worldToMap(flag.pos.x, flag.pos.z);
      const color = flag.owner ? GAME.teams[flag.owner].color : '#d9d2c0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12,12,10,0.75)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(flag.id, p.x, p.y + 0.5);
      if (flag.progress > 0 && flag.progress < 1 && flag.capturingTeam) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, -Math.PI / 2, -Math.PI / 2 + flag.progress * Math.PI * 2);
        ctx.strokeStyle = GAME.teams[flag.capturingTeam].color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    for (const v of this.game.vehicles) {
      if (v.destroyed) continue;
      const p = this.worldToMap(v.getCenter().x, v.getCenter().z);
      ctx.fillStyle = GAME.teams[v.team].color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      ctx.strokeStyle = '#111';
      ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
    }

    for (const b of this.game.bots) {
      if (b.dead || b.downed) continue;
      if (b.team !== player.team) continue;
      const p = this.worldToMap(b.position.x, b.position.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = GAME.teams[b.team].color;
      ctx.fill();
    }

    if (this.game.spotted) {
      for (const [entity, until] of this.game.spotted) {
        if (until < this.game.time || !entity || entity.dead || entity.downed) continue;
        const p = this.worldToMap(entity.getCenter().x, entity.getCenter().z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = GAME.teams.B.color;
        ctx.fill();
      }
    }

    if (player && !player.dead) {
      const p = this.worldToMap(player.position.x, player.position.z);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-player.yaw);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.lineTo(0, 3);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fillStyle = '#f2ead8';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = 'rgba(214,161,90,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(214,161,90,0.9)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', s / 2, 12);
  }
}
