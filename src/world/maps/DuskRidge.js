import { MapBase } from '../MapBase.js';
import { getMap } from '../../config/maps.js';
import { buildFort, buildStation, buildVineyard, buildTrenches, buildRuinedTank, buildAidStation } from '../Builders.js';
import { buildSandbagWall, buildBarbedWire, buildRubble } from '../Props.js';

// 黃昏嶺：山頂堡壘、鐵路車站、葡萄園與台地。
export class DuskRidge extends MapBase {
  constructor(game) {
    super(game, getMap('dusk-ridge'));
  }

  buildLayout() {
    const f = this.meta.features;
    const terrain = this.terrain;

    buildFort(this, f.fort);
    buildStation(this, f.station);
    buildVineyard(this, { center: f.vineyard.center, rows: f.vineyard.rows });

    buildTrenches(this, {
      trenches: this.meta.terrain.trenches,
      wire: [[[-40, -60], [-24, -54], [0, -56], [24, -60]]]
    });

    for (let i = 0; i < 5; i++) {
      const z = -34 + i * 18;
      for (let x = -105; x < 105; x += 12) {
        const y = terrain.heightAt(x, z);
        if (Math.abs(x) < 22 && z < -30) continue;
        this.batch.addBox(7.5, 0.9, 0.6, x, y + 0.45, z, 0, 'stone', true);
        if ((x / 12 + i) % 3 === 0) {
          this.batch.addBox(0.6, 1.1, 0.6, x + 3.5, y + 0.55, z + 0.5, 0, 'stone', true);
        }
      }
    }

    buildRuinedTank(this, -58, 34, 0.9);
    buildAidStation(this, -74, 52, terrain);
    buildSandbagWall(this.batch, [[-82, 32], [-66, 28], [-52, 34]], 1.1, terrain);
    buildSandbagWall(this.batch, [[-84, 48], [-62, 46]], 1.0, terrain);
    buildSandbagWall(this.batch, [[68, 52], [84, 50], [94, 58]], 1.0, terrain);
    buildBarbedWire(this.group, this.batch, this.assets, [[-90, 24], [-52, 20], [-16, 24]], terrain, 0);
    buildBarbedWire(this.group, this.batch, this.assets, [[28, -40], [54, -34], [78, -42]], terrain, 0);
    buildRubble(this.batch, 54, 48, 4, 9, terrain);
    buildRubble(this.batch, -48, -36, 4, 8, terrain);

    buildSandbagWall(this.batch, [[-10, -62], [4, -58], [14, -64]], 1.1, terrain);
  }
}
