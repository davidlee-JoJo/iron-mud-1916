import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

// 吉普車：高速、可旋轉的車載機槍，適合快速穿越地圖。
export class Jeep extends Vehicle {
  constructor(game, opts) {
    super(game, {
      ...opts,
      type: 'jeep',
      maxHp: 350,
      bodyHeight: 0.85,
      half: { x: 1.0, y: 0.7, z: 1.9 },
      mass: 950,
      name: 'jeep'
    });
  }

  buildMesh() {
    const a = this.assets;
    const metal = a.materials.metalDark;
    const steel = a.materials.metal;
    const team = a.teamMaterial(this.team);

    const add = (w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0, parent = this.mesh) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const cyl = (rt, rb, h, x, y, z, mat, rx = 0, ry = 0, rz = 0, parent = this.mesh) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    add(1.9, 0.5, 3.4, 0, 0, 0, metal);
    add(1.7, 0.35, 1.0, 0, 0.28, -1.25, metal, -0.08);
    add(1.6, 0.3, 0.9, 0, 0.3, 1.25, metal);
    add(1.4, 0.35, 0.5, 0, 0.45, 0.1, team);
    add(0.7, 0.5, 0.2, 0, 0.55, -0.55, metal, 0.15);
    add(0.12, 0.5, 0.12, -0.7, 0.55, -0.55, steel);
    add(0.12, 0.5, 0.12, 0.7, 0.55, -0.55, steel);
    add(1.4, 0.08, 0.08, 0, 0.82, -0.55, steel);
    add(0.2, 0.35, 1.6, -0.95, 0.05, 0.3, team);
    add(0.2, 0.35, 1.6, 0.95, 0.05, 0.3, team);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        cyl(0.38, 0.38, 0.3, sx * 0.95, -0.5, sz * 1.15, metal, 0, 0, Math.PI / 2);
        add(0.16, 0.16, 0.16, sx * 0.95, -0.5, sz * 1.15, steel);
      }
    }

    this.mgGroup = new THREE.Group();
    this.mgGroup.position.set(0, 0.85, 0.15);
    this.mesh.add(this.mgGroup);
    cyl(0.05, 0.06, 0.8, 0, 0.25, 0, steel);
    add(0.35, 0.12, 0.5, 0, 0.62, -0.1, metal);
    cyl(0.045, 0.055, 1.1, 0, 0.6, -0.7, steel, Math.PI / 2, 0, 0);
    add(0.24, 0.2, 0.3, 0, 0.6, -0.15, metal);
    add(0.5, 0.5, 0.06, 0, 0.55, -0.35, steel, 0, 0, 0);
    add(0.6, 0.1, 0.1, 0, 0.9, -0.2, team);

    add(0.18, 0.5, 0.18, -1.0, 0.4, 1.55, steel);
    add(0.18, 0.5, 0.18, 1.0, 0.4, 1.55, steel);
    add(2.0, 0.12, 0.3, 0, 0.65, 1.55, metal);
  }
}
