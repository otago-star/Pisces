import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { World }          from './world.js';
import { Player }         from './player.js';
import { createUnderwaterPass } from './underwater.js';
import { AudioManager }   from './audio.js';

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
document.body.appendChild(renderer.domElement);

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000c1a);
scene.fog = new THREE.FogExp2(0x001428, 0.032);

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  300
);

// ─── Audio ────────────────────────────────────────────────────────────────────
const audio = new AudioManager();

// ─── World & Player ───────────────────────────────────────────────────────────
const world  = new World(scene);
const player = new Player(scene, camera, renderer.domElement, audio);

// ─── Post-processing ──────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const underwaterPass = createUnderwaterPass();
composer.addPass(underwaterPass);

// ─── UI wiring ────────────────────────────────────────────────────────────────
const overlay    = document.getElementById('overlay');
const crosshair  = document.getElementById('crosshair');
const hud        = document.getElementById('hud');
const depthMeter = document.getElementById('depth-meter');
const depthVal   = document.getElementById('depth-val');

document.getElementById('startBtn').addEventListener('click', () => {
  player.lock();
});

player.onLock(() => {
  overlay.style.display    = 'none';
  crosshair.style.display  = 'block';
  hud.style.display        = 'block';
  depthMeter.style.display = 'block';
  audio.start();
});

player.onUnlock(() => {
  overlay.style.display    = 'flex';
  crosshair.style.display  = 'none';
  hud.style.display        = 'none';
  depthMeter.style.display = 'none';
});

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Game loop ────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  // Cap delta to avoid physics explosion after tab switch
  const delta = Math.min(clock.getDelta(), 0.05);

  world.update(delta);
  player.update(delta);

  // Depth display — water surface is at y=20, floor ~−12
  const depth = Math.max(0, Math.round(20 - camera.position.y));
  depthVal.textContent = depth;

  composer.render();
}

animate();
