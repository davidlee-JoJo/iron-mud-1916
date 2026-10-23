import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// 後製：色調分級、暗角、顆粒、受擊紅暈、泛光與反鋸齒。
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    damage: { value: 0 },
    tint: { value: new THREE.Vector3(1, 1, 1) },
    resolution: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float damage;
    uniform vec3 tint;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, 1.08);
      color.rgb = (color.rgb - 0.5) * 1.0 + 0.5;
      color.rgb *= tint;

      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.98, 0.45, length(d));
      color.rgb *= mix(1.0, vig, 0.18);

      float edge = smoothstep(0.22, 0.72, length(d));
      color.rgb = mix(color.rgb, vec3(0.55, 0.015, 0.01), damage * edge * 0.85);

      float grain = hash(vUv * resolution + fract(time) * 41.0);
      color.rgb += (grain - 0.5) * 0.022;
      gl_FragColor = color;
    }
  `
};

export class PostFX {
  constructor(game) {
    this.game = game;
    this.renderer = game.renderer;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(game.scene, game.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.62, 0.82);
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.smaa = new SMAAPass(1, 1);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    this.composer.addPass(this.smaa);
    this.quality = 'medium';
    this.time = 0;
  }

  setScene(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  setTint(hex) {
    const c = new THREE.Color(hex);
    this.grade.uniforms.tint.value.set(c.r, c.g, c.b);
  }

  setDamage(v) {
    this.grade.uniforms.damage.value = v;
  }

  setQuality(q, size) {
    this.quality = q;
    const pr = q === 'high' ? Math.min(window.devicePixelRatio, 1.6) : q === 'medium' ? Math.min(window.devicePixelRatio, 1.25) : 1;
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.w, size.h);
    this.bloom.enabled = q !== 'low';
    this.smaa.enabled = q !== 'low';
    this.bloom.strength = q === 'high' ? 0.4 : 0.28;
    this.bloom.radius = q === 'high' ? 0.75 : 0.6;
    this.grade.uniforms.resolution.value.set(size.w * pr, size.h * pr);
    this.smaa.setSize(size.w, size.h);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.smaa.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
  }

  render(dt) {
    this.time += dt;
    this.grade.uniforms.time.value = this.time;
    this.composer.render(dt);
  }
}
