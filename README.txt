PISCES — Underwater World
=========================

A Three.js browser game. Swim through an atmospheric underwater environment.
Blender (.glb/.gltf) assets can be dropped in when ready.

── HOW TO RUN ───────────────────────────────────────────────────────────────────

  Option A (easiest):
    Install the "Live Server" extension in VS Code, then right-click index.html
    and choose "Open with Live Server".

  Option B (Python):
    Open a terminal in this folder and run:
      python -m http.server 8000
    Then open http://localhost:8000 in your browser.

  ES modules require a local server — opening index.html directly as a file
  will NOT work.

── CONTROLS ─────────────────────────────────────────────────────────────────────

  W A S D     — Swim forward / back / strafe
  SPACE       — Rise
  SHIFT       — Sink
  MOUSE       — Look around
  ESC         — Pause / release cursor

── PROJECT STRUCTURE ────────────────────────────────────────────────────────────

  index.html          Entry point + UI
  src/
    main.js           Renderer, scene, post-processing, game loop
    world.js          Ocean floor, rocks, coral stubs, bubbles, caustics
    player.js         Capsule physics (swim, drag, buoyancy), pointer-lock
    underwater.js     Screen-space wave warp + color grade shader pass
  assets/
    models/           Drop Blender .glb exports here for import

── BLENDER IMPORT NOTES ─────────────────────────────────────────────────────────

  Export from Blender as glTF 2.0 (.glb).
  Load with Three.js GLTFLoader:

    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    const loader = new GLTFLoader();
    loader.load('assets/models/mymodel.glb', (gltf) => {
      scene.add(gltf.scene);
    });
