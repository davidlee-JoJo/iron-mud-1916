import * as THREE from 'three';
import { WEAPONS } from '../config/weapons.js';
import { damp } from '../core/MathUtils.js';

// 第一人稱武器模型與動畫，使用獨立場景避免穿牆。
export class Viewmodel {
  constructor(game) {
    this.game = game;
    this.assets = game.assets;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 20);
    this.scene.add(new THREE.HemisphereLight(0xd8e4f0, 0x40382c, 1.1));
    const light = new THREE.DirectionalLight(0xffd9a8, 1.5);
    light.position.set(1.5, 2.5, 1);
    this.scene.add(light);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.hip = new THREE.Vector3(0.26, -0.24, -0.55);
    this.adsPos = new THREE.Vector3(0, -0.12, -0.42);
    this.models = {};
    this.current = null;
    this.classId = 'assault';
    this.weaponId = 'mp18';
    this.adsT = 0;
    this.recoil = 0;
    this.reloadAnim = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.time = 0;
    this.hidden = false;
    this.buildAll();
    this.buildMuzzle();
    this.setClass('assault', 'mp18');
  }

  addBox(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  }

  addCylinder(parent, rt, rb, h, x, y, z, mat, rx = Math.PI / 2) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    parent.add(mesh);
    return mesh;
  }

  buildAll() {
    const a = this.assets;
    const rifleMat = a.materials.rifle;
    const stockMat = a.materials.stock;
    const leatherMat = a.materials.leather;
    const metalMat = a.materials.metalDark;
    const skinMat = a.materials.skin;

    const smg = new THREE.Group();
    this.addBox(smg, 0.08, 0.11, 0.34, 0, 0, -0.05, rifleMat);
    this.addCylinder(smg, 0.022, 0.022, 0.32, 0, 0.01, -0.28, metalMat);
    this.addBox(smg, 0.05, 0.2, 0.09, 0, -0.12, -0.02, metalMat);
    this.addBox(smg, 0.06, 0.1, 0.22, 0, -0.01, 0.17, stockMat);
    this.addBox(smg, 0.05, 0.13, 0.07, 0, -0.11, 0.07, leatherMat);
    this.addBox(smg, 0.02, 0.03, 0.02, 0, 0.08, -0.22, metalMat);
    this.addBox(smg, 0.14, 0.08, 0.05, 0, -0.09, -0.02, leatherMat);
    this.models.mp18 = smg;

    const rifle = new THREE.Group();
    this.addBox(rifle, 0.07, 0.1, 0.55, 0, 0, -0.18, rifleMat);
    this.addCylinder(rifle, 0.018, 0.018, 0.5, 0, 0.01, -0.55, metalMat);
    this.addBox(rifle, 0.07, 0.14, 0.3, 0, -0.01, 0.24, stockMat);
    this.addBox(rifle, 0.06, 0.18, 0.08, 0, -0.12, 0.02, metalMat);
    this.addBox(rifle, 0.02, 0.04, 0.02, 0, 0.08, -0.38, metalMat);
    this.addBox(rifle, 0.15, 0.08, 0.05, 0, -0.08, 0.02, leatherMat);
    this.models.selbstlader = rifle;

    const lmg = new THREE.Group();
    this.addBox(lmg, 0.1, 0.12, 0.5, 0, 0, -0.12, rifleMat);
    this.addCylinder(lmg, 0.03, 0.03, 0.55, 0, 0.02, -0.5, metalMat);
    this.addBox(lmg, 0.08, 0.16, 0.16, 0, -0.1, -0.02, metalMat);
    this.addBox(lmg, 0.07, 0.12, 0.32, 0, -0.01, 0.26, stockMat);
    this.addBox(lmg, 0.02, 0.2, 0.02, -0.08, -0.14, -0.32, metalMat);
    this.addBox(lmg, 0.02, 0.2, 0.02, 0.08, -0.14, -0.32, metalMat);
    this.addBox(lmg, 0.17, 0.08, 0.06, 0, -0.09, 0.02, leatherMat);
    this.models.bar = lmg;

    const sniper = new THREE.Group();
    this.addBox(sniper, 0.07, 0.1, 0.6, 0, 0, -0.2, rifleMat);
    this.addCylinder(sniper, 0.017, 0.017, 0.75, 0, 0.01, -0.75, metalMat);
    this.addBox(sniper, 0.07, 0.15, 0.4, 0, -0.01, 0.3, stockMat);
    const scope = this.addCylinder(sniper, 0.035, 0.035, 0.3, 0, 0.1, -0.15, metalMat);
    scope.rotation.x = Math.PI / 2;
    this.addBox(sniper, 0.02, 0.07, 0.02, 0, 0.05, -0.15, metalMat);
    this.addBox(sniper, 0.02, 0.07, 0.02, 0, 0.05, 0.0, metalMat);
    this.addBox(sniper, 0.03, 0.03, 0.14, 0.07, 0.02, 0.02, metalMat, 0, 0, 0.5);
    this.addBox(sniper, 0.15, 0.08, 0.05, 0, -0.08, 0.04, leatherMat);
    this.models.gewehr98 = sniper;

    const pistol = new THREE.Group();
    this.addBox(pistol, 0.06, 0.1, 0.25, 0, 0.02, -0.05, metalMat);
    this.addBox(pistol, 0.05, 0.16, 0.08, 0, -0.11, 0.04, leatherMat, 0.15);
    this.addCylinder(pistol, 0.015, 0.015, 0.12, 0, 0.02, -0.2, metalMat);
    this.models.p08 = pistol;

    const hands = new THREE.Group();
    this.addBox(hands, 0.1, 0.1, 0.2, 0.02, -0.16, -0.02, skinMat);
    this.addBox(hands, 0.1, 0.1, 0.18, -0.02, -0.17, 0.18, skinMat);
    this.hands = hands;
  }

  buildMuzzle() {
    const mat = this.assets.sprites.flash.clone();
    mat.opacity = 0;
    this.muzzle = new THREE.Sprite(mat);
    this.muzzle.scale.set(0.3, 0.3, 1);
    this.scene.add(this.muzzle);
    this.muzzleLife = 0;
  }

  setClass(classId, weaponId) {
    this.classId = classId;
    this.weaponId = weaponId;
    this.setWeapon(weaponId);
  }

  setWeapon(weaponId) {
    if (this.current) this.root.remove(this.current);
    this.current = this.models[weaponId] || this.models.mp18;
    this.root.add(this.current);
    this.current.add(this.hands);
    this.hands.position.set(0, 0, 0);
    this.weaponId = weaponId;
  }

  fireKick() {
    this.recoil = 1;
    this.muzzleLife = 0.05;
    this.muzzle.material.opacity = 1;
    this.muzzle.position.set(0, 0.02, -0.55);
  }

  setHidden(v) {
    this.hidden = v;
    this.root.visible = !v;
  }

  update(dt, player) {
    this.time += dt;
    if (this.hidden) return;
    const def = WEAPONS[this.weaponId];
    const ads = player.adsT;
    this.adsT = ads;
    this.recoil = damp(this.recoil, 0, 9, dt);

    const hip = this.hip;
    const adsP = this.adsPos;
    const targetX = hip.x + (adsP.x - hip.x) * ads;
    const targetY = hip.y + (adsP.y - hip.y) * ads;
    const targetZ = hip.z + (adsP.z - hip.z) * ads;

    const moving = player.moveSpeed > 0.5;
    const bob = moving ? Math.sin(player.bobTime * 2) * 0.006 : 0;
    const sway = Math.sin(this.time * 1.1) * 0.002 * (1 - ads);
    this.root.position.set(
      targetX + sway + this.swayX,
      targetY + bob + Math.cos(this.time * 1.7) * 0.0015 * (1 - ads) + this.swayY,
      targetZ + this.recoil * 0.06
    );
    this.root.rotation.x = this.recoil * 0.12 + (moving ? Math.sin(player.bobTime) * 0.004 : 0);
    this.root.rotation.y = -this.swayX * 2;
    this.root.rotation.z = (1 - ads) * 0.02;

    if (player.weapon?.reloading) {
      const t = 1 - player.weapon.reloadTimer / player.weapon.def.reload;
      const dip = Math.sin(Math.min(1, t) * Math.PI);
      this.root.rotation.x += dip * 0.5;
      this.root.position.y -= dip * 0.18;
      this.root.rotation.z += dip * 0.25;
    }
    if (player.weapon?.boltTimer > 0) {
      this.root.rotation.z += Math.sin(player.weapon.boltTimer * 10) * 0.08;
    }

    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      this.muzzle.material.opacity = Math.max(0, this.muzzleLife / 0.05);
      const tipZ = def ? -0.55 : -0.55;
      this.muzzle.position.set(0, 0.02, tipZ);
      this.muzzle.visible = true;
    } else {
      this.muzzle.visible = false;
    }
  }

  setSway(dx, dy) {
    this.swayX = damp(this.swayX, -dx * 0.0009, 8, 1 / 60);
    this.swayY = damp(this.swayY, dy * 0.0009, 8, 1 / 60);
  }

  render(renderer) {
    const prev = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prev;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.muzzle.material.dispose();
  }
}
