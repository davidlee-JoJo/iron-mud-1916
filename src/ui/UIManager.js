import { HUD } from './HUD.js';
import { Menus } from './Menu.js';

// 統一管理選單與 HUD 的顯示狀態。
export class UIManager {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui-root');
    this.menus = new Menus(game, this.root);
    this.hud = new HUD(game, this.root);
    this.menus.hideAll();
  }

  showMenu() {
    this.menus.showMenu();
    this.hud.hide();
  }

  showMapSelect() {
    this.menus.showMapSelect();
    this.hud.hide();
  }

  showDeploy(data) {
    this.menus.showDeploy(data);
    this.hud.hide();
  }

  refreshDeploy(data) {
    this.menus.currentDeploy = data;
    this.menus.refreshDeploy();
  }

  showHud() {
    this.menus.hideAll();
    this.hud.show();
    this.hud.setupWorld();
  }

  showPause() {
    this.menus.showPause();
  }

  hidePause() {
    this.menus.hidePause();
  }

  showRoundEnd(data) {
    this.menus.showRoundEnd(data);
    this.hud.hide();
  }

  showLoading(label, progress) {
    this.menus.showLoading(label, progress);
  }

  hideLoading() {
    this.menus.hideLoading();
  }

  hideAll() {
    this.menus.hideAll();
    this.hud.hide();
  }
}
