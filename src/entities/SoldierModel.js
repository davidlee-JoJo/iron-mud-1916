import * as THREE from 'three';

// 低多邊形士兵模型：可走動、瞄準、倒地與死亡。
export class SoldierModel {
  constructor(assets, team, classId) {
    this.assets = assets;
    this.team = team;
    this.classId = classId;
    this.root = new THREE.Group();
    this.root.name = 'soldier';
    this.phase = 0;
    this.downed = false;
    this.dead = false;
    this.build();
  }

  addBox(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  build() {
    const a = this.assets;
    const teamMat = a.teamMaterial(this.team);
    const helmetMat = a.helmetMaterial(this.team);

    this.torso = new THREE.Group();
    this.root.add(this.torso);
    this.addBox(this.torso, 0.56, 0.68, 0.32, 0, 1.18, 0, teamMat);
    this.addBox(this.torso, 0.6, 0.12, 0.34, 0, 0.84, 0, a.materials.leather);
    this.addBox(this.torso, 0.42, 0.5, 0.2, 0, 1.22, 0.22, a.materials.leather);

    this.head = this.addBox(this.torso, 0.27, 0.3, 0.27, 0, 1.62, 0, a.materials.skin);
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 8), helmetMat);
    helmet.position.set(0, 1.76, 0);
    helmet.castShadow = true;
    this.torso.add(helmet);
    this.addBox(this.torso, 0.4, 0.06, 0.42, 0, 1.84, 0, helmetMat);

    if (this.classId === 'medic') {
      this.addBox(this.torso, 0.16, 0.1, 0.02, -0.34, 1.24, 0.1, a.materials.medic);
      this.addBox(this.torso, 0.06, 0.16, 0.02, -0.34, 1.24, 0.1, a.materials.medic);
      this.addBox(this.torso, 0.26, 0.32, 0.18, 0.34, 1.18, 0.16, a.materials.medic);
    } else if (this.classId === 'engineer') {
      this.addBox(this.torso, 0.3, 0.4, 0.2, -0.32, 1.16, 0.18, a.materials.engineer);
      this.addBox(this.torso, 0.1, 0.5, 0.1, 0.3, 0.9, 0.1, a.materials.woodDark);
    } else if (this.classId === 'scout') {
      this.addBox(this.torso, 0.34, 0.06, 0.3, 0, 1.8, 0.02, helmetMat);
    } else {
      this.addBox(this.torso, 0.18, 0.22, 0.16, -0.32, 0.95, 0.16, a.materials.leather);
      this.addBox(this.torso, 0.18, 0.22, 0.16, 0.32, 0.95, 0.16, a.materials.leather);
    }

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL.position.set(-0.15, 0.86, 0);
    this.legR.position.set(0.15, 0.86, 0);
    this.root.add(this.legL, this.legR);
    this.addBox(this.legL, 0.2, 0.72, 0.22, 0, -0.36, 0, teamMat);
    this.addBox(this.legR, 0.2, 0.72, 0.22, 0, -0.36, 0, teamMat);
    this.addBox(this.legL, 0.22, 0.18, 0.28, 0, -0.76, 0.04, a.materials.boots);
    this.addBox(this.legR, 0.22, 0.18, 0.28, 0, -0.76, 0.04, a.materials.boots);

    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-0.36, 1.45, 0);
    this.armR.position.set(0.36, 1.45, 0);
    this.torso.add(this.armL, this.armR);
    this.addBox(this.armL, 0.15, 0.58, 0.17, 0, -0.29, 0, teamMat);
    this.addBox(this.armR, 0.15, 0.58, 0.17, 0, -0.29, 0, teamMat);
    this.addBox(this.armL, 0.14, 0.16, 0.15, 0, -0.62, 0.02, a.materials.skin);
    this.addBox(this.armR, 0.14, 0.16, 0.15, 0, -0.62, 0.02, a.materials.skin);

    const rifleLength = this.classId === 'scout' ? 1.25 : this.classId === 'engineer' ? 1.05 : 0.95;
    this.rifle = new THREE.Group();
    this.rifle.position.set(0.18, 1.18, -0.42);
    this.torso.add(this.rifle);
    this.addBox(this.rifle, 0.09, 0.14, rifleLength, 0, 0, -rifleLength * 0.25, a.materials.rifle);
    this.addBox(this.rifle, 0.07, 0.11, 0.3, 0, -0.02, 0.38, a.materials.stock);
    if (this.classId === 'scout') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), a.materials.metalDark);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.12, -0.15);
      this.rifle.add(scope);
    }
  }

  setPosition(pos, yaw) {
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
  }

  reset() {
    this.dead = false;
    this.downed = false;
    this.phase = 0;
    this.root.visible = true;
    this.root.rotation.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.torso.position.set(0, 0, 0);
  }

  update(dt, speed, aiming) {
    if (this.dead) return;
    if (this.downed) {
      this.root.rotation.z = Math.PI / 2;
      this.root.rotation.x = 0;
      this.root.position.y += 0.3;
      this.legL.rotation.x = 0.1;
      this.legR.rotation.x = -0.1;
      this.armL.rotation.x = 0.2;
      this.armR.rotation.x = 0.3;
      return;
    }
    this.root.rotation.z = 0;
    this.phase += speed * dt * 2.6;
    const swing = Math.sin(this.phase) * Math.min(1, speed / 3) * 0.65;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (aiming) {
      this.armR.rotation.x = -1.35;
      this.armL.rotation.x = -1.15;
      this.armR.rotation.z = -0.1;
      this.armL.rotation.z = 0.2;
      this.rifle.rotation.x = -0.02;
    } else {
      this.armL.rotation.x = -swing * 0.45;
      this.armR.rotation.x = swing * 0.45;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
      this.rifle.rotation.x = 0.25;
    }
    this.torso.position.y = Math.abs(Math.sin(this.phase)) * 0.025;
    this.head.position.y = 1.62 + Math.abs(Math.sin(this.phase)) * 0.01;
  }

  setDowned(v) {
    this.downed = v;
    this.root.rotation.z = v ? Math.PI / 2 : 0;
  }

  setDead() {
    this.dead = true;
    this.downed = false;
    this.root.rotation.z = Math.PI / 2;
    this.root.rotation.x = -0.15;
    this.root.position.y += 0.15;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}
