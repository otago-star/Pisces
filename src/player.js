import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────
const SWIM_FORCE     = 14;   // force applied per input axis (m/s²)
const WATER_DRAG     = 4.0;  // exponential drag coefficient
const NET_GRAVITY    = -0.5; // gravity + buoyancy combined (almost neutrally buoyant)
const FLOOR_Y        = -10;  // approximate floor — capsule bottom rests here
const SURFACE_Y      =  19;  // just under water surface

// ─── Player ───────────────────────────────────────────────────────────────────
export class Player {
  constructor(scene, camera, domElement, audio) {
    this._camera  = camera;
    this._scene   = scene;
    this._vel     = new THREE.Vector3();
    this._keys    = {};
    this._lockCbs   = [];
    this._unlockCbs = [];
    this._audio   = audio;       // AudioManager — may be null

    // Spawn mid-water, slightly forward
    camera.position.set(0, 0, 10);

    // ── Capsule mesh (visible body for future 3rd-person / shadow casting) ──
    const capGeo = new THREE.CapsuleGeometry(0.38, 1.1, 8, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color:       0x88aadd,
      roughness:   0.4,
      metalness:   0.2,
      transparent: true,
      opacity:     0.0, // hidden in first-person; set > 0 for 3rd-person later
    });
    this._capsule = new THREE.Mesh(capGeo, capMat);
    this._capsule.castShadow = true;
    scene.add(this._capsule);

    // ── PointerLock controls (attaches camera to a yaw object) ──
    this._controls = new PointerLockControls(camera, domElement);
    scene.add(this._controls.getObject());

    this._controls.addEventListener('lock',   () => this._lockCbs.forEach(fn => fn()));
    this._controls.addEventListener('unlock', () => this._unlockCbs.forEach(fn => fn()));

    // ── Input ──
    window.addEventListener('keydown', e => { this._keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this._keys[e.code] = false; });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────
  lock()         { this._controls.lock(); }
  unlock()       { this._controls.unlock(); }
  onLock(fn)     { this._lockCbs.push(fn); }
  onUnlock(fn)   { this._unlockCbs.push(fn); }

  // ─── Per-frame update ────────────────────────────────────────────────────────
  update(delta) {
    if (!this._controls.isLocked) return;

    const cam = this._camera;
    const vel = this._vel;
    const k   = this._keys;

    // ── Build swim direction from camera orientation ──
    const forward = new THREE.Vector3();
    const right   = new THREE.Vector3();
    cam.getWorldDirection(forward);
    right.crossVectors(forward, cam.up).normalize();

    const input = new THREE.Vector3();
    if (k['KeyW'])                              input.addScaledVector(forward,  1);
    if (k['KeyS'])                              input.addScaledVector(forward, -1);
    if (k['KeyA'])                              input.addScaledVector(right,   -1);
    if (k['KeyD'])                              input.addScaledVector(right,    1);
    if (k['Space'])                             input.y += 1;
    if (k['ShiftLeft'] || k['ShiftRight'])      input.y -= 1;

    if (input.lengthSq() > 0) input.normalize();

    // ── Physics ──
    // Weak net downward force (mostly neutrally buoyant)
    vel.y += NET_GRAVITY * delta;

    // Swim impulse
    vel.addScaledVector(input, SWIM_FORCE * delta);

    // Water drag — exponential decay
    const drag = Math.exp(-WATER_DRAG * delta);
    vel.multiplyScalar(drag);

    // ── Integrate position ──
    const obj = this._controls.getObject();
    obj.position.addScaledVector(vel, delta);

    // ── Boundary collisions ──
    const footY = FLOOR_Y + 0.95; // capsule half-height
    if (obj.position.y < footY) {
      obj.position.y = footY;
      if (vel.y < 0) vel.y = 0;
    }

    if (obj.position.y > SURFACE_Y) {
      const wasBelow = (obj.position.y - vel.y * delta) < SURFACE_Y;
      obj.position.y = SURFACE_Y;
      if (vel.y > 0) {
        if (wasBelow && this._audio) this._audio.playSplash(Math.min(vel.y * 0.4, 1.0));
        vel.y = 0;
      }
    }

    // ── Audio: swim sound driven by horizontal+vertical speed ──
    if (this._audio) {
      const depth = Math.max(0, 20 - obj.position.y);
      this._audio.update(vel.length(), depth, delta);
    }

    // ── Sync capsule mesh to camera position ──
    this._capsule.position.copy(obj.position);
    this._capsule.position.y -= 0.5;  // offset to centre of body below eyes
    this._capsule.quaternion.copy(cam.quaternion);
  }
}
