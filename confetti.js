// confetti.js - High-performance canvas confetti system
class ConfettiEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
    this.colors = [
      '#FF0055', '#00FFCC', '#00E5FF', '#FFCC00', 
      '#FF00FF', '#9d4edd', '#2ec4b6', '#ff9f1c'
    ];
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 100) {
    if (!this.canvas || !this.ctx) return;
    const x = this.canvas.width / 2;
    const y = this.canvas.height * 0.7; // Burst upwards from bottom-middle area

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        size: Math.random() * 8 + 6,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 18 - 8,
        gravity: 0.4,
        drag: 0.98,
        opacity: 1
      });
    }

    if (!this.animationFrame) {
      this.tick();
    }
  }

  tick() {
    if (!this.canvas || !this.ctx) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.008;

      if (p.opacity <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity;
      
      // Draw rectangular confetti piece
      this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationFrame = requestAnimationFrame(() => this.tick());
    } else {
      this.animationFrame = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.particles = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

export const confetti = new ConfettiEngine();
