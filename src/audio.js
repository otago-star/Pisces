// ─── AudioManager — procedural underwater soundscape ─────────────────────────
// All sounds are synthesised with the Web Audio API; no external files needed.
//
// Sounds:
//   • Underwater ambient drone  — constant low rumble + filtered noise
//   • Pressure hum              — low-pitched resonant hum that varies with depth
//   • Swim paddling             — rhythmic whoosh bursts tied to player speed
//   • Bubble pops               — short rising-pitch noise bursts (random + on movement)
//   • Fish clicks / chirps      — sparse random bioacoustic events
//   • Whale moan                — rare, very low distant moan
//   • Surface splash            — wide noise burst when breaking the surface
//
export class AudioManager {
  constructor() {
    this._ctx          = null;   // AudioContext — created on first user gesture
    this._masterGain   = null;
    this._ambientGain  = null;
    this._swimGain     = null;

    // Swim rhythm state
    this._swimAccum    = 0;       // time since last paddle burst
    this._swimInterval = 0.55;    // seconds between paddle strokes
    this._lastSpeed    = 0;

    // Random event timers
    this._nextBubble   = 1.5;
    this._nextFish     = this._randFishDelay();
    this._nextWhale    = 40 + Math.random() * 80;

    this._running      = false;
  }

  // ─── Init / start ────────────────────────────────────────────────────────────
  // Call once after a user gesture (pointer-lock triggers this).
  start() {
    if (this._running) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.72;
    this._masterGain.connect(this._ctx.destination);

    this._buildAmbient();
    this._running = true;
  }

  // ─── Per-frame tick ───────────────────────────────────────────────────────────
  // speed      — player velocity magnitude (m/s)
  // depth      — metres below surface (positive)
  // delta      — frame time in seconds
  update(speed, depth, delta) {
    if (!this._running) return;

    // ── Swim paddle rhythm ──
    if (speed > 0.15) {
      const interval = Math.max(0.18, this._swimInterval / (0.5 + speed * 0.18));
      this._swimAccum += delta;
      if (this._swimAccum >= interval) {
        this._swimAccum = 0;
        this._playPaddle(speed);
      }
    } else {
      this._swimAccum = Math.max(0, this._swimAccum - delta * 2);
    }

    // ── Depth-based ambient pitch shift ──
    if (this._depthLFO) {
      // Slightly lower everything deeper
      this._ambientGain.gain.setTargetAtTime(
        Math.max(0.2, 1.0 - depth * 0.008),
        this._ctx.currentTime,
        0.5
      );
    }

    // ── Random bubble pops ──
    this._nextBubble -= delta;
    if (this._nextBubble <= 0) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this._scheduleBubble(i * (0.05 + Math.random() * 0.12));
      }
      this._nextBubble = 1.2 + Math.random() * 3.5;
    }

    // ── Random fish sounds ──
    this._nextFish -= delta;
    if (this._nextFish <= 0) {
      this._playFish();
      this._nextFish = this._randFishDelay();
    }

    // ── Rare whale moan ──
    this._nextWhale -= delta;
    if (this._nextWhale <= 0) {
      this._playWhaleMoan();
      this._nextWhale = 55 + Math.random() * 90;
    }
  }

  // ─── Surface splash ───────────────────────────────────────────────────────────
  playSplash(intensity = 1.0) {
    if (!this._running) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Wide-band noise burst, filtered around 500–4000 Hz
    const buf    = this._whiteNoiseBuf(ctx, 0.35);
    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    const bp     = ctx.createBiquadFilter();
    bp.type      = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value   = 0.6;

    const env    = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.55 * intensity, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    src.connect(bp);
    bp.connect(env);
    env.connect(this._masterGain);
    src.start(now);
    src.stop(now + 0.4);
  }

  // ─── Ambient drone ────────────────────────────────────────────────────────────
  _buildAmbient() {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    this._ambientGain = ctx.createGain();
    this._ambientGain.gain.value = 0.55;
    this._ambientGain.connect(this._masterGain);

    // 1. Deep sub-bass rumble (oscillator)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 42;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.18;
    osc.connect(oscGain);
    oscGain.connect(this._ambientGain);
    osc.start();

    // 2. Slightly detuned second partial for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 83.7;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.08;
    osc2.connect(osc2Gain);
    osc2Gain.connect(this._ambientGain);
    osc2.start();

    // 3. Filtered continuous noise (water hiss)
    const noiseLen = 4; // seconds — will loop
    const noiseBuf = this._whiteNoiseBuf(ctx, noiseLen);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop   = true;

    const lp = ctx.createBiquadFilter();
    lp.type  = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.9;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.07;
    noiseSrc.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this._ambientGain);
    noiseSrc.start();

    // 4. Slow LFO on rumble freq — makes it feel like current
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    this._depthLFO = lfo;

    // 5. Resonant mid-frequency hum (pressure sensation)
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 110;
    const humLp = ctx.createBiquadFilter();
    humLp.type  = 'lowpass';
    humLp.frequency.value = 180;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.022;
    hum.connect(humLp);
    humLp.connect(humGain);
    humGain.connect(this._ambientGain);
    hum.start();
  }

  // ─── Paddle / swimming whoosh ─────────────────────────────────────────────────
  _playPaddle(speed) {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const buf  = this._whiteNoiseBuf(ctx, 0.22);
    const src  = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;

    const bp   = ctx.createBiquadFilter();
    bp.type    = 'bandpass';
    // Faster swim → brighter
    bp.frequency.value = 280 + speed * 38;
    bp.Q.value = 1.8;

    const env  = ctx.createGain();
    const vol  = Math.min(0.22, 0.06 + speed * 0.028);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    src.connect(bp);
    bp.connect(env);
    env.connect(this._masterGain);
    src.start(now);
    src.stop(now + 0.25);
  }

  // ─── Single bubble ────────────────────────────────────────────────────────────
  _scheduleBubble(delay = 0) {
    const ctx = this._ctx;
    const now = ctx.currentTime + delay;

    const buf  = this._whiteNoiseBuf(ctx, 0.08);
    const src  = ctx.createBufferSource();
    src.buffer = buf;

    const bp   = ctx.createBiquadFilter();
    bp.type    = 'bandpass';
    const startFreq = 600 + Math.random() * 800;
    bp.frequency.setValueAtTime(startFreq, now);
    bp.frequency.exponentialRampToValueAtTime(startFreq * 2.4, now + 0.07);
    bp.Q.value = 6;

    const env  = ctx.createGain();
    const vol  = 0.04 + Math.random() * 0.06;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    src.connect(bp);
    bp.connect(env);
    env.connect(this._masterGain);
    src.start(now);
    src.stop(now + 0.12);
  }

  // ─── Fish click / chirp ───────────────────────────────────────────────────────
  _playFish() {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const type = Math.random();

    if (type < 0.5) {
      // Click — very short noise transient
      this._playClick(now);
    } else if (type < 0.8) {
      // Chirp — ascending frequency sweep
      this._playChirp(now);
    } else {
      // Burst — rapid series of clicks (crustacean / snapping shrimp)
      const count = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        this._playClick(now + i * (0.025 + Math.random() * 0.04));
      }
    }
  }

  _playClick(time) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    const freq = 800 + Math.random() * 2400;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.025);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.05, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);

    osc.connect(env);
    env.connect(this._masterGain);
    osc.start(time);
    osc.stop(time + 0.03);
  }

  _playChirp(time) {
    const ctx  = this._ctx;
    const dur  = 0.08 + Math.random() * 0.14;
    const osc  = ctx.createOscillator();
    osc.type   = 'sine';
    const f0   = 400 + Math.random() * 800;
    const f1   = f0 * (1.5 + Math.random() * 1.5);
    osc.frequency.setValueAtTime(f0, time);
    osc.frequency.exponentialRampToValueAtTime(f1, time + dur);

    const env  = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.055, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.02);

    osc.connect(env);
    env.connect(this._masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  // ─── Distant whale moan ───────────────────────────────────────────────────────
  _playWhaleMoan() {
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const dur = 3.5 + Math.random() * 3;

    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    const f0  = 55 + Math.random() * 40;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.linearRampToValueAtTime(f0 * (0.6 + Math.random() * 0.8), now + dur);

    // Vibrato
    const vib  = ctx.createOscillator();
    vib.type   = 'sine';
    vib.frequency.value = 4.5 + Math.random() * 2;
    const vibG = ctx.createGain();
    vibG.gain.value = 2.5;
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    vib.start(now);
    vib.stop(now + dur + 0.1);

    const lp   = ctx.createBiquadFilter();
    lp.type    = 'lowpass';
    lp.frequency.value = 200;

    const env  = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.12, now + 0.6);
    env.gain.setValueAtTime(0.12, now + dur - 1.0);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(lp);
    lp.connect(env);
    env.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.1);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  _whiteNoiseBuf(ctx, duration) {
    const sr     = ctx.sampleRate;
    const frames = Math.ceil(sr * duration);
    const buf    = ctx.createBuffer(1, frames, sr);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _randFishDelay() {
    return 4 + Math.random() * 14;
  }
}
