import * as THREE from 'three';

// ─── Tuning constants ─────────────────────────────────────────────────────────
const SWIM_FORCE     = 14;   // force applied per input axis (m/s²)
const WATER_DRAG     = 4.0;  // exponential drag coefficient
const NET_GRAVITY    = -0.5; // gravity + buoyancy combined (almost neutrally buoyant)
const FLOOR_Y        = -10;  // approximate floor — capsule bottom rests here
const SURFACE_Y      =  19;  // just under water surface
const LOOK_SENSITIVITY = 0.0022;

// ─── Player ───────────────────────────────────────────────────────────────────
export class Player {
  constructor(scene, camera, domElement, audio) {
    this._camera  = camera;
    this._scene   = scene;
    this._domElement = domElement;
    this._vel     = new THREE.Vector3();
    this._keys    = {};
    this._lockCbs   = [];
    this._unlockCbs = [];
    this._audio   = audio;       // AudioManager — may be null
    this._mobileControls = null;
    this._mobileActive = false;
    this._isLocked = false;
    this._lookYaw = 0;
    this._lookPitch = 0;

    // Shared rig for both desktop pointer lock and mobile touch controls.
    this._rig = new THREE.Group();
    this._yaw = new THREE.Group();
    this._pitch = new THREE.Group();
    this._yaw.add(this._pitch);
    this._pitch.add(camera);
    this._rig.add(this._yaw);
    scene.add(this._rig);

    // Spawn mid-water, slightly forward.
    this._rig.position.set(0, 0, 10);
    camera.position.set(0, 0, 0);

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

    this._onPointerLockChange = () => {
      const locked = document.pointerLockElement === this._domElement;
      if (this._isLocked === locked) return;
      this._isLocked = locked;
      if (locked) {
        this._lockCbs.forEach((fn) => fn());
      } else if (!this._mobileActive) {
        this._unlockCbs.forEach((fn) => fn());
      }
    };

    this._onMouseMove = (event) => {
      if (!this._isLocked) return;
      this._lookYaw -= event.movementX * LOOK_SENSITIVITY;
      this._lookPitch -= event.movementY * LOOK_SENSITIVITY;
      this._lookPitch = THREE.MathUtils.clamp(this._lookPitch, -1.35, 1.35);
    };

    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    window.addEventListener('mousemove', this._onMouseMove);

    // ── Input ──
    window.addEventListener('keydown', e => { this._keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this._keys[e.code] = false; });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────
  lock() {
    if (this._domElement.requestPointerLock) {
      this._domElement.requestPointerLock();
    }
  }

  unlock() {
    if (document.pointerLockElement === this._domElement) {
      document.exitPointerLock();
    }
  }

  activateMobile() {
    this._mobileActive = true;
    this._lockCbs.forEach((fn) => fn());
  }

  setMobileControls(mobileControls) {
    this._mobileControls = mobileControls;
  }

  onLock(fn)     { this._lockCbs.push(fn); }
  onUnlock(fn)   { this._unlockCbs.push(fn); }

  // ─── Per-frame update ────────────────────────────────────────────────────────
  update(delta) {
    if (!this._isLocked && !this._mobileActive) return;

    const mobileState = this._mobileControls ? this._mobileControls.getState() : null;
    if (this._mobileControls) {
      const look = this._mobileControls.consumeLook();
      this._lookYaw -= look.lookDX * LOOK_SENSITIVITY * 0.8;
      this._lookPitch -= look.lookDY * LOOK_SENSITIVITY * 0.8;
      this._lookPitch = THREE.MathUtils.clamp(this._lookPitch, -1.25, 1.25);
    }

    this._yaw.rotation.y = this._lookYaw;
    this._pitch.rotation.x = this._lookPitch;

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

    if (mobileState) {
      if (Math.abs(mobileState.moveX) > 0.03) input.addScaledVector(right, mobileState.moveX);
      if (Math.abs(mobileState.moveY) > 0.03) input.addScaledVector(forward, mobileState.moveY);
      if (mobileState.ascend) input.y += 1;
      if (mobileState.descend) input.y -= 1;
    }

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
    this._rig.position.addScaledVector(vel, delta);

    // ── Boundary collisions ──
    const footY = FLOOR_Y + 0.95; // capsule half-height
    if (this._rig.position.y < footY) {
      this._rig.position.y = footY;
      if (vel.y < 0) vel.y = 0;
    }

    if (this._rig.position.y > SURFACE_Y) {
      const wasBelow = (this._rig.position.y - vel.y * delta) < SURFACE_Y;
      this._rig.position.y = SURFACE_Y;
      if (vel.y > 0) {
        if (wasBelow && this._audio) this._audio.playSplash(Math.min(vel.y * 0.4, 1.0));
        vel.y = 0;
      }
    }

    // ── Audio: swim sound driven by horizontal+vertical speed ──
    if (this._audio) {
      const depth = Math.max(0, 20 - this._rig.position.y);
      this._audio.update(vel.length(), depth, delta);
    }

    // ── Sync capsule mesh to camera position ──
    this._capsule.position.copy(this._rig.position);
    this._capsule.position.y -= 0.5;  // offset to centre of body below eyes
    this._capsule.quaternion.setFromEuler(new THREE.Euler(this._lookPitch, this._lookYaw, 0, 'YXZ'));
  }
}
