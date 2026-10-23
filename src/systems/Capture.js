import { GAME } from '../config/game.js';
import { setFlagOwner } from '../world/Props.js';

// 征服模式：統計旗點內雙方人數，推進佔領進度並更新旗幟顏色。
export class Capture {
  constructor(game) {
    this.game = game;
    this.flags = game.world.flags;
  }

  update(dt) {
    for (const flag of this.flags) {
      let a = 0;
      let b = 0;
      for (const s of this.game.getSoldiers()) {
        if (s.dead || s.downed) continue;
        if (s.isPlayer && s.inVehicle) continue;
        const d = s.getCenter().distanceTo(flag.pos);
        if (d <= flag.radius) {
          if (s.team === 'A') a++;
          else if (s.team === 'B') b++;
        }
      }

      if (a > 0 && b > 0) {
        flag.contested = true;
        continue;
      }
      flag.contested = false;

      const team = a > 0 ? 'A' : b > 0 ? 'B' : null;
      if (!team) {
        if (!flag.owner && flag.progress > 0) {
          flag.progress = Math.max(0, flag.progress - dt * 0.025);
          if (flag.progress === 0) flag.capturingTeam = null;
        }
        continue;
      }

      if (flag.owner === team) {
        flag.progress = 1;
        flag.capturingTeam = null;
        continue;
      }

      if (flag.capturingTeam !== team) {
        flag.capturingTeam = team;
        flag.progress = 0;
      }
      const count = team === 'A' ? a : b;
      const rate = GAME.captureRate + GAME.captureRatePerSoldier * Math.min(4, count);
      flag.progress += rate * dt;
      if (flag.progress >= 1) {
        flag.progress = 1;
        flag.owner = team;
        flag.capturingTeam = null;
        this.onCaptured(flag, team);
      }
    }
  }

  onCaptured(flag, team) {
    setFlagOwner(flag, team, {
      A: GAME.teams.A.color,
      B: GAME.teams.B.color
    });
    this.game.audio.playCapture();
    this.game.ui.hud.toast(`${flag.id} · ${flag.name} 被 ${GAME.teams[team].name} 佔領`);
    for (const s of this.game.getSoldiers()) {
      if (s.team !== team || s.downed || s.dead) continue;
      if (s.getCenter().distanceTo(flag.pos) <= flag.radius) {
        s.captures = (s.captures || 0) + 1;
        s.score = (s.score || 0) + 50;
      }
    }
  }
}
