import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ─── Underwater post-process shader ──────────────────────────────────────────
//
//  Applies three effects:
//    1. Screen-space wave distortion (simulates refraction)
//    2. Deep-water blue-green color grade
//    3. Radial vignette for depth atmosphere
//
const UnderwaterShader = {
  uniforms: {
    tDiffuse: { value: null },
    time:     { value: 0.0 },
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
    uniform float     time;
    varying vec2      vUv;

    void main() {
      vec2 uv = vUv;

      // Subtle multi-frequency wave warp
      float wX = sin(uv.y * 16.0 + time * 0.75) * 0.0022
               + sin(uv.y *  7.0 - time * 0.40) * 0.0010;
      float wY = sin(uv.x * 13.0 + time * 0.55) * 0.0018
               + sin(uv.x *  5.5 - time * 0.30) * 0.0008;
      uv.x += wX;
      uv.y += wY;

      vec4 color = texture2D(tDiffuse, uv);

      // Blue-green deep-water tint
      color.r *= 0.22;
      color.g *= 0.68;
      color.b  = min(color.b * 1.08 + 0.04, 1.0);

      // Soft radial vignette
      vec2  vig = vUv * 2.0 - 1.0;
      float v   = 1.0 - dot(vig * 0.42, vig * 0.42);
      color.rgb *= clamp(v, 0.0, 1.0);

      // Slight additional darkening toward the bottom of screen
      float depthFade = 0.75 + 0.25 * vUv.y;
      color.rgb *= depthFade;

      gl_FragColor = color;
    }
  `,
};

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createUnderwaterPass() {
  const pass      = new ShaderPass(UnderwaterShader);
  const startTime = performance.now();

  // Wrap render to inject time each frame without needing an external update call
  const _render = pass.render.bind(pass);
  pass.render = function (renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    pass.uniforms.time.value = (performance.now() - startTime) / 1000;
    _render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  };

  return pass;
}
