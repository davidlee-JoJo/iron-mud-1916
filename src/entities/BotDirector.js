import { GAME } from '../config/game.js';
import { RNG } from '../core/Random.js';
import { Bot } from './Bot.js';

// 管理 8v8 AI：分時 AI 更新、死亡重生與小隊組成。
const CLASS_PLAN = [
  'assault', 'assault', 'assault', 'medic',
  'medic', 'engineer', 'engineer', 'scout',
  'assault', 'assault', 'medic', 'engineer',
  'scout', 'assault', 'medic', 'engineer'
];

export class BotDirector {
  constructor(game) {
    this.game = game;
    this.bots = [];
    this.respawnQueue = [];
    this.frame = 0;
    this.rng = new RNG(4242);
  }

  spawnAll() {
    this.clear();
    const namesA = this.rng.shuffle(GAME.namesA.slice());
    const namesB = this.rng.shuffle(GAME.namesB.slice());
    for (const team of ['A', 'B']) {
      const names = team === 'A' ? namesA : namesB;
      const count = team === GAME.playerTeam ? GAME.playerTeamBotCount : GAME.botCountPerTeam;
      for (let i = 0; i < count; i++) {
        const classId = CLASS_PLAN[i % CLASS_PLAN.length];
        const squad = i % 4;
        const slot = i % 8;
        const bot = new Bot(this.game, team, classId, names[i % names.length], slot, squad);
        const spawn = this.game.world.getSpawn(team);
        bot.reset(spawn);
        this.bots.push(bot);
      }
    }
  }

  update(dt) {
    this.frame++;
    for (const bot of this.bots) {
      bot.updateVisual(dt);
      bot.updateBleedout(dt);
      if (this.frame % 8 === bot.slot) {
        bot.updateAI(0.125);
      }
    }

    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const entry = this.respawnQueue[i];
      entry.timer -= dt;
      if (entry.timer <= 0) {
        this.respawnQueue.splice(i, 1);
        if (!this.game.roundActive) continue;
        if (this.game.tickets[entry.bot.team] <= 0) continue;
        const spawn = this.game.world.getSpawn(entry.bot.team);
        entry.bot.reset(spawn);
      }
    }
  }

  updateMovement(dt) {
    for (const bot of this.bots) bot.updateMovement(dt);
  }

  scheduleRespawn(bot) {
    if (this.respawnQueue.some((e) => e.bot === bot)) return;
    this.respawnQueue.push({ bot, timer: GAME.botRespawnDelay });
  }

  getBots(team) {
    return this.bots.filter((b) => b.team === team && !b.dead);
  }

  clear() {
    for (const bot of this.bots) bot.dispose();
    this.bots = [];
    this.respawnQueue = [];
    this.frame = 0;
  }
}
