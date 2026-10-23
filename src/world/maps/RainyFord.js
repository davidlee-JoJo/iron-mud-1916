import { MapBase } from '../MapBase.js';
import { getMap } from '../../config/maps.js';
import { buildDepot, buildMill, buildBridge, buildFootbridge, buildBarges, buildTrenches, buildRuinedTank, buildAidStation } from '../Builders.js';
import { buildSandbagWall, buildBarbedWire, buildCrates, buildRubble, buildArtillery } from '../Props.js';

// 陰雨渡口：河流切穿地圖，斷橋、淺灘與磨坊。
export class RainyFord extends MapBase {
  constructor(game) {
    super(game, getMap('rainy-ford'));
  }

  buildLayout() {
    const f = this.meta.features;
    const terrain = this.terrain;

    buildDepot(this, f.depot);
    buildMill(this, f.mill);
    buildBridge(this, f.bridge);
    buildFootbridge(this, f.footbridge);
    buildBarges(this, { barges: f.barges });

    buildTrenches(this, {
      trenches: this.meta.terrain.trenches,
      wire: [[[-104, 70], [-78, 76], [-52, 78], [-28, 72]]],
      sandbagLines: [[[-104, 84], [-76, 88], [-50, 86]]]
    });

    buildRuinedTank(this, 54, 24, 1.3);
    buildAidStation(this, -58, 88, terrain);
    for (const p of f.artillery || []) buildArtillery(this.batch, p[0], p[1], this.rng.range(0, Math.PI), terrain, this.assets);

    buildSandbagWall(this.batch, [[-16, 52], [-4, 54], [8, 52]], 1.1, terrain);
    buildSandbagWall(this.batch, [[-18, -68], [-6, -66], [6, -68]], 1.0, terrain);
    buildSandbagWall(this.batch, [[-100, -10], [-82, -6], [-66, -12]], 1.1, terrain);
    buildBarbedWire(this.group, this.batch, this.assets, [[-118, 44], [-78, 40], [-40, 44], [-16, 40]], terrain, 0);
    buildBarbedWire(this.group, this.batch, this.assets, [[16, 40], [48, 44], [86, 40], [118, 44]], terrain, 0);
    buildBarbedWire(this.group, this.batch, this.assets, [[-118, -52], [-78, -48], [-40, -54]], terrain, 0);

    for (let i = 0; i < 8; i++) {
      const z = 46 + i * 4;
      this.batch.addBox(0.18, 1.1, 0.18, -18, terrain.heightAt(-18, z) + 0.55, z, 0, 'wood', true);
      this.batch.addBox(0.18, 1.1, 0.18, 18, terrain.heightAt(18, z) + 0.55, z, 0, 'wood', true);
    }

    buildCrates(this.world, this.group, this.assets, this.rng, [
      { x: -88, y: terrain.heightAt(-88, 12), z: 12 },
      { x: -86, y: terrain.heightAt(-86, 13), z: 13 },
      { x: 30, y: terrain.heightAt(30, 18), z: 18 },
      { x: 32, y: terrain.heightAt(32, 19), z: 19 }
    ]);
    buildRubble(this.batch, 72, 8, 5, 10, terrain);
    buildRubble(this.batch, -74, 58, 4, 8, terrain);
  }
}
