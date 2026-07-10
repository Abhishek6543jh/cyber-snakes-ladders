// audio.js - Web Audio API Synthesizer and Procedural Ambient Music Engine
class AmbientSynth {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.isPlaying = false;
    this.nodes = [];
    this.timer = null;
    this.tempo = 5.0; // duration per chord in seconds
    this.currentChord = 0;
    
    // Ambient sci-fi chord progression frequencies
    this.chords = [
      [130.81, 164.81, 196.00, 246.94], // Cmaj7 (C3, E3, G3, B3)
      [174.61, 220.00, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
      [110.00, 164.81, 220.00, 261.63], // Am7 (A2, E3, A3, C4)
      [146.83, 196.00, 246.94, 293.66]  // G7 (D3, G3, B3, D4)
    ];
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playChordLoop();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nodes.forEach(n => {
      try {
        n.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        n.gain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.5);
        setTimeout(() => n.osc.stop(), 600);
      } catch (e) {}
    });
    this.nodes = [];
  }

  playChordLoop() {
    if (!this.isPlaying) return;

    const now = this.ctx.currentTime;
    const chord = this.chords[this.currentChord];
    
    // Play notes staggered (arpeggio feel)
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.2);

      // Holo lowpass filter sweep
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + this.tempo);

      gain.gain.setValueAtTime(0.0, now);
      // Soft fade-in (pad envelope)
      gain.gain.linearRampToValueAtTime(0.05, now + 1.5 + idx * 0.2);
      // Soft fade-out
      gain.gain.setValueAtTime(0.05, now + this.tempo - 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + this.tempo - 0.1);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.2);
      osc.stop(now + this.tempo);

      const nodeObj = { osc, gain, filter };
      this.nodes.push(nodeObj);
      
      setTimeout(() => {
        this.nodes = this.nodes.filter(n => n !== nodeObj);
      }, this.tempo * 1000 + 500);
    });

    this.currentChord = (this.currentChord + 1) % this.chords.length;
    
    this.timer = setTimeout(() => {
      this.playChordLoop();
    }, this.tempo * 1000 - 200); // slight overlap for crossfade
  }
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.synth = null;
    this.musicEnabled = false;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch (e) {
      console.warn("Web Audio API not supported in this browser.");
    }
  }

  toggleMusic() {
    this.init();
    if (!this.enabled || !this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (!this.synth) {
      this.synth = new AmbientSynth(this.ctx);
    }

    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.synth.start();
    } else {
      this.synth.stop();
    }
    return this.musicEnabled;
  }

  playDiceRoll() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const duration = 0.8;
    const rollsCount = 6;

    for (let i = 0; i < rollsCount; i++) {
      const rollTime = now + (i * (duration / rollsCount));
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80 + Math.random() * 120, rollTime);
      osc.frequency.exponentialRampToValueAtTime(40, rollTime + 0.08);

      gain.gain.setValueAtTime(0.2, rollTime);
      gain.gain.exponentialRampToValueAtTime(0.01, rollTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(rollTime);
      osc.stop(rollTime + 0.09);
    }
  }

  playMoveHop() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playLadderClimb() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major scale
    const stepDuration = 0.08;

    notes.forEach((freq, index) => {
      const noteTime = now + (index * stepDuration);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + stepDuration * 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + stepDuration);
    });
  }

  playSnakeSlide() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const duration = 0.8;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(100, now + duration);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    const noise = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    noise.type = 'sine';
    noise.frequency.setValueAtTime(2000, now);
    noise.frequency.setValueAtTime(1000, now + duration * 0.5);

    noiseGain.gain.setValueAtTime(0.03, now);
    noiseGain.gain.linearRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    noise.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
    noise.start(now);
    noise.stop(now + duration);
  }

  playWinFanfare() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const chords = [
      [261.63, 329.63, 392.00], // C
      [349.23, 440.00, 523.25], // F
      [392.00, 493.88, 587.33], // G
      [523.25, 659.25, 783.99, 1046.50] // C 8ve
    ];

    chords.forEach((chord, chordIdx) => {
      const chordTime = now + chordIdx * 0.25;
      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordTime);
        
        gain.gain.setValueAtTime(0.1, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.005, chordTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(chordTime);
        osc.stop(chordTime + 0.4);
      });
    });
  }

  playClick() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const audio = new AudioEngine();
