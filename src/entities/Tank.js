import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

// 坦克：鎖定俯仰/翻滾的剛體、車體轉向、砲塔與主砲。
export class Tank extends Vehicle {
  constructor(game, opts) {
    super(game, {
      ...opts,
      type: 'tank',
      maxHp: 1000,
      bodyHeight: 1.25,
      half: { x: 1.5, y: 0.9, z: 2.7 },
      mass: 5200,
      friction: 0.55,
      name: 'tank'
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

    add(2.9, 1.0, 5.4, 0, 0, 0, metal);
    add(2.3, 0.5, 3.5, 0, 0.62, 0.3, metal);
    add(2.6, 0.9, 0.35, 0, 0.05, -2.6, metal, 0.18);

    for (const side of [-1, 1]) {
      add(0.55, 0.85, 5.7, side * 1.4, -0.55, 0, steel);
      for (let i = 0; i < 5; i++) {
        cyl(0.4, 0.4, 0.62, side * 1.4, -0.55, -2.0 + i * 1.0, metal, 0, 0, Math.PI / 2);
      }
      add(0.18, 0.28, 4.6, side * 1.75, 0.25, 0.2, team);
    }

    add(0.7, 0.35, 0.8, -0.9, 0.95, -1.5, metal);
    add(0.7, 0.35, 0.8, 0.9, 0.95, -1.5, metal);
    cyl(0.07, 0.09, 1.4, 1.05, 0.6, 2.1, metal, Math.PI / 2, 0, 0);
    cyl(0.35, 0.35, 0.12, 0, 0.92, 0.7, metal);
    add(0.9, 0.08, 0.9, 0, 0.98, 0.7, metal);

    this.turretGroup = new THREE.Group();
    this.turretGroup.position.set(0, 1.15, 0.35);
    this.turretGroup.rotation.order = 'YXZ';
    this.mesh.add(this.turretGroup);
    add(1.85, 0.6, 2.05, 0, 0, 0, metal, 0, 0, 0, this.turretGroup);
    add(1.3, 0.28, 1.2, 0, 0.38, 0.2, metal, 0, 0, 0, this.turretGroup);
    add(0.2, 0.3, 0.9, -0.95, 0.05, 0.4, team, 0, 0, 0, this.turretGroup);
    add(0.2, 0.3, 0.9, 0.95, 0.05, 0.4, team, 0, 0, 0, this.turretGroup);

    this.barrelGroup = new THREE.Group();
    this.barrelGroup.position.set(0, 0.12, -1.0);
    this.turretGroup.add(this.barrelGroup);
    cyl(0.14, 0.17, 3.2, 0, 0, -1.4, metal, Math.PI / 2, 0, 0, this.barrelGroup);
    add(0.34, 0.34, 0.5, 0, 0, -3.05, metal, 0, 0, 0, this.barrelGroup);
    add(0.5, 0.35, 0.7, 0, 0, -0.15, metal, 0, 0, 0, this.barrelGroup);

    this.mgGroup = new THREE.Group();
    this.mgGroup.position.set(0.75, 0.42, -0.4);
    this.turretGroup.add(this.mgGroup);
    add(0.16, 0.16, 0.3, 0, 0, 0, metal, 0, 0, 0, this.mgGroup);
    cyl(0.045, 0.055, 1.0, 0, 0, -0.55, steel, Math.PI / 2, 0, 0, this.mgGroup);
    add(0.24, 0.2, 0.25, 0, -0.12, 0.1, metal, 0, 0, 0, this.mgGroup);

    add(0.2, 0.12, 2.2, -1.55, -0.1, 1.0, steel);
    add(0.2, 0.12, 2.2, 1.55, -0.1, 1.0, steel);
  }
}
