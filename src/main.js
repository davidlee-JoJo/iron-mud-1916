import { Game } from './core/Game.js';

const game = new Game(document.getElementById('app'));
window.__game = game;

game.init().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot-error');
  if (el) {
    el.hidden = false;
    el.textContent = `遊戲初始化失敗\n\n${err?.stack || err}`;
  }
});
