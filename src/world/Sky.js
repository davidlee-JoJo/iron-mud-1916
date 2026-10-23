import * as THREE from 'three';

// 程序化天空：漸層、太陽光暈與緩慢飄動的雲層。
const vertexShader = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float cloudAmount;
  uniform float time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 sky = mix(horizonColor, topColor, smoothstep(-0.02, 0.62, h));
    sky = mix(groundColor, sky, smoothstep(-0.28, 0.02, h));

    float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
    sky += sunColor * pow(sunDot, 900.0) * 4.0;
    sky += sunColor * pow(sunDot, 10.0) * 0.38;

    if (h > 0.015) {
      vec2 uv = dir.xz / max(h + 0.28, 0.08) * 0.55;
      uv += vec2(time * 0.0022, time * 0.0013);
      float c = fbm(uv * 2.2);
      float cloud = smoothstep(0.48, 0.78, c) * cloudAmount * smoothstep(0.02, 0.35, h);
      vec3 cloudColor = mix(vec3(0.62, 0.60, 0.58), sunColor, 0.25);
      sky = mix(sky, cloudColor, cloud * 0.62);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class Sky {
  constructor(meta) {
    this.meta = meta;
    const sky = meta.sky;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(sky.top) },
        horizonColor: { value: new THREE.Color(sky.horizon) },
        groundColor: { value: new THREE.Color(sky.ground) },
        sunColor: { value: new THREE.Color(sky.sun) },
        sunDir: { value: new THREE.Vector3(...sky.sunDir).normalize() },
        cloudAmount: { value: sky.cloud ?? 0.5 },
        time: { value: 0 }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), this.material);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  update(dt, camera) {
    this.material.uniforms.time.value += dt;
    this.mesh.position.copy(camera.position);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
