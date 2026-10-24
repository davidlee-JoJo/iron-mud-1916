import { MapBase } from '../MapBase.js';
import { getMap } from '../../config/maps.js';
import { buildVillage, buildTrenches, buildRuinedTank, buildAidStation } from '../Builders.js';
import { buildSandbagWall, buildBarbedWire, buildCart, buildRubble, buildArtillery } from '../Props.js';

// 灰燼谷：北側村落、中央彈坑、南側戰壕。
export class AshenValley extends MapBase {
  constructor(game) {
    super(game, getMap('ashen-valley'));
  }

  buildLayout() {
    const f = this.meta.features;
    const terrain = this.terrain;

    buildVillage(this, {
      center: f.village.center,
      radius: f.village.radius,
      buildings: f.village.buildings,
      church: f.village.church,
      churchPos: f.village.churchPos
    });

    buildTrenches(this, {
      trenches: this.meta.terrain.trenches,
      wire: [
        [[-130, 96], [-70, 94], [-20, 96], [30, 95], [90, 96], [135, 98]],
        [[-52, 104], [-44, 72], [-38, 48]]
      ],
      // 沙袋線在戰壕出入口處留缺口（x=-25 與 x=50），避免擋住南北向通道。
      sandbagLines: [
        [[-60, 108], [-34, 107]],
        [[-16, 105], [41, 106.2]]
      ]
    });

    buildRuinedTank(this, -18, 8, 0.6);
    buildRuinedTank(this, 26, -14, -1.2);
    buildAidStation(this, 12, 112, terrain);

    for (const p of f.artillery || []) buildArtillery(this.batch, p[0], p[1], this.rng.range(0, Math.PI), terrain, this.assets);

    const crater = f.craterField.center;
    const ring = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 1.2 - 0.2;
      ring.push([crater[0] + Math.cos(a) * 24, crater[1] + Math.sin(a) * 24]);
    }
    buildSandbagWall(this.batch, ring, 0.9, terrain);
    buildBarbedWire(this.group, this.batch, this.assets, [[-42, 30], [-10, 36], [24, 34], [52, 26]], terrain, 0);
    buildBarbedWire(this.group, this.batch, this.assets, [[-56, -12], [-24, -20], [12, -18]], terrain, 0);

    buildSandbagWall(this.batch, [[-24, -82], [-8, -78], [12, -82]], 1.1, terrain);
    buildSandbagWall(this.batch, [[-30, 112], [-18, 116]], 1.0, terrain);
    buildCart(this.batch, 20, -66, 1.1, terrain);
    buildRubble(this.batch, 46, 12, 4, 10, terrain);
    buildRubble(this.batch, -58, 18, 5, 12, terrain);
  }
}
