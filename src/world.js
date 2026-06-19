import * as THREE from 'three';

// ─── Caustic fragment shader ──────────────────────────────────────────────────
const CAUSTIC_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CAUSTIC_FRAG = `
  uniform float time;
  varying vec2 vUv;

  float caustic(vec2 uv, float t) {
    vec2 p = uv * 7.0;
    float v = sin(p.x * 2.1 + t * 1.3) * sin(p.y * 1.9 + t * 0.8)
            + sin((p.x + p.y) * 1.7 + t * 0.9) * sin((p.x - p.y) * 1.4 + t * 1.1)
            + sin(p.x * 3.2 + t * 0.5) * sin(p.y * 2.7 + t * 1.4);
    return smoothstep(0.35, 0.9, abs(v) * 0.4 + 0.5);
  }

  void main() {
    float c = caustic(vUv, time);
    vec3  col = vec3(0.0, 0.35, 0.7) * c;
    gl_FragColor = vec4(col, c * 0.22);
  }
`;

// ─── World ────────────────────────────────────────────────────────────────────
export class World {
  constructor(scene) {
    this._scene  = scene;
    this._time   = 0;

    this._setupLights();
    this._setupFloor();
    this._setupRocks();
    this._setupCoral();
    this._setupBubbles();
    this._setupWaterSurface();
    this._setupCaustics();
  }

  // ── Lighting ────────────────────────────────────────────────────────────────
  _setupLights() {
    const s = this._scene;

    // Very dim deep-ocean ambient
    s.add(new THREE.AmbientLight(0x001c3a, 3.0));

    // Sun shaft from directly above — cool blue-white
    const sun = new THREE.DirectionalLight(0x5599cc, 3.5);
    sun.position.set(8, 60, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 200;
    sun.shadow.camera.left   = -60;
    sun.shadow.camera.right  =  60;
    sun.shadow.camera.top    =  60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0004;
    s.add(sun);

    // Dim greenish fill from the side (bioluminescent feel)
    const fill = new THREE.PointLight(0x00bb55, 2.5, 90, 1.5);
    fill.position.set(-25, 2, -15);
    s.add(fill);

    // Another moody blue point light
    const blue = new THREE.PointLight(0x0044aa, 2.0, 70, 2);
    blue.position.set(20, -5, 10);
    s.add(blue);
  }

  // ── Ocean floor ─────────────────────────────────────────────────────────────
  _setupFloor() {
    const geo = new THREE.PlaneGeometry(220, 220, 100, 100);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Layered noise for organic-looking seabed
      const y = Math.sin(x * 0.14) * 1.4
              + Math.sin(z * 0.11) * 1.1
              + Math.sin(x * 0.37 + z * 0.28) * 0.5
              + Math.sin(x * 0.8  - z * 0.6)  * 0.2
              + (Math.random() - 0.5) * 0.25;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color:     0x162e22,
      roughness: 0.95,
      metalness: 0.0,
    });

    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -12;
    floor.receiveShadow = true;
    this._scene.add(floor);
  }

  // ── Rocks ────────────────────────────────────────────────────────────────────
  _setupRocks() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e2e2a,
      roughness: 0.92,
      metalness: 0.08,
    });

    const placements = [
      [-8,  -10, -15, 3.5], [ 12, -11,  -8, 2.5], [-20, -11,   5, 4.2],
      [ 5,  -11,  20, 3.0], [ -5, -11,   8, 1.8], [ 18, -11,  15, 1.9],
      [-15, -11,  -5, 2.4], [  0, -11, -25, 5.0], [ 25, -11, -20, 3.3],
      [ 30, -11,   5, 2.1], [-30, -11,  15, 2.8], [-10, -11,  30, 2.2],
    ];

    placements.forEach(([x, y, z, s]) => {
      const detail = Math.random() > 0.5 ? 1 : 0;
      const geo = new THREE.IcosahedronGeometry(s, detail);
      const p   = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setX(i, p.getX(i) * (1 + (Math.random() - 0.5) * 0.35));
        p.setY(i, p.getY(i) * (1 + (Math.random() - 0.5) * 0.45));
        p.setZ(i, p.getZ(i) * (1 + (Math.random() - 0.5) * 0.35));
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      this._scene.add(mesh);
    });
  }

  // ── Coral stubs (placeholder until Blender imports) ──────────────────────────
  _setupCoral() {
    const colors  = [0xff4488, 0xff6622, 0xffaa00, 0x66ffaa, 0xaa44ff];
    const placements = [
      [-6, -11, -10], [14, -11, 5], [-18, -11, 12],
      [8,  -11, -18], [3,  -11, 15], [-12, -11, 20],
      [22, -11, -8],  [-3, -11, -20],
    ];

    placements.forEach(([x, y, z]) => {
      const count  = 3 + Math.floor(Math.random() * 4);
      const color  = colors[Math.floor(Math.random() * colors.length)];
      const mat    = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.1,
        emissive: new THREE.Color(color).multiplyScalar(0.08),
      });
      for (let i = 0; i < count; i++) {
        const h  = 0.6 + Math.random() * 1.8;
        const r  = 0.06 + Math.random() * 0.12;
        const geo = new THREE.CylinderGeometry(r * 0.4, r, h, 6, 1);
        const m   = new THREE.Mesh(geo, mat);
        m.position.set(
          x + (Math.random() - 0.5) * 1.5,
          y + h / 2,
          z + (Math.random() - 0.5) * 1.5
        );
        m.rotation.set(
          (Math.random() - 0.5) * 0.3,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.3
        );
        m.castShadow = true;
        this._scene.add(m);
      }
    });
  }

  // ── Bubble particles ─────────────────────────────────────────────────────────
  _setupBubbles() {
    const COUNT    = 400;
    const positions  = new Float32Array(COUNT * 3);
    const speeds     = new Float32Array(COUNT);
    const drifts     = new Float32Array(COUNT); // side-drift phase

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 28 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      speeds[i]  = 0.4 + Math.random() * 1.6;
      drifts[i]  = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color:         0xaaddff,
      size:          0.10,
      transparent:   true,
      opacity:       0.45,
      sizeAttenuation: true,
      depthWrite:    false,
    });

    this._bubbles          = new THREE.Points(geo, mat);
    this._bubbleSpeeds     = speeds;
    this._bubbleDrifts     = drifts;
    this._scene.add(this._bubbles);
  }

  // ── Water surface ────────────────────────────────────────────────────────────
  _setupWaterSurface() {
    const geo = new THREE.PlaneGeometry(220, 220, 50, 50);
    const mat = new THREE.MeshStandardMaterial({
      color:       0x003366,
      transparent: true,
      opacity:     0.30,
      side:        THREE.DoubleSide,
      roughness:   0.05,
      metalness:   0.4,
      depthWrite:  false,
    });

    const surface = new THREE.Mesh(geo, mat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y  = 20;
    this._scene.add(surface);

    // Cache base Y values for wave animation
    const pos = geo.attributes.position;
    this._waterGeo    = geo;
    this._waterBaseY  = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this._waterBaseY[i] = pos.getY(i);
    }
  }

  // ── Caustic overlay ───────────────────────────────────────────────────────────
  _setupCaustics() {
    const geo = new THREE.PlaneGeometry(120, 120);
    const mat = new THREE.ShaderMaterial({
      uniforms:       { time: { value: 0 } },
      vertexShader:   CAUSTIC_VERT,
      fragmentShader: CAUSTIC_FRAG,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y  = -11.4;
    this._causticMesh = mesh;
    this._scene.add(mesh);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────────
  update(delta) {
    this._time += delta;
    const t = this._time;

    // Animate bubbles
    const bPos = this._bubbles.geometry.attributes.position;
    for (let i = 0; i < this._bubbleSpeeds.length; i++) {
      let y = bPos.getY(i) + this._bubbleSpeeds[i] * delta;
      let x = bPos.getX(i) + Math.sin(t * 0.6 + this._bubbleDrifts[i]) * 0.008;
      if (y > 20) {
        y = -14 + Math.random() * 2;
        x = (Math.random() - 0.5) * 90;
        bPos.setZ(i, (Math.random() - 0.5) * 90);
      }
      bPos.setX(i, x);
      bPos.setY(i, y);
    }
    bPos.needsUpdate = true;

    // Animate water surface waves
    const wPos = this._waterGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) {
      const x = wPos.getX(i);
      const z = wPos.getZ(i);
      const wave = Math.sin(x * 0.28 + t * 0.85) * 0.45
                 + Math.sin(z * 0.22 + t * 0.65) * 0.35
                 + Math.sin((x + z) * 0.15 + t * 0.5) * 0.2;
      wPos.setY(i, this._waterBaseY[i] + wave);
    }
    wPos.needsUpdate = true;
    this._waterGeo.computeVertexNormals();

    // Advance caustic time
    this._causticMesh.material.uniforms.time.value = t;
  }
}
