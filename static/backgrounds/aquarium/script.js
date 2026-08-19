(function() {
  'use strict';

  const COLORS = {
    waterTop: 'rgba(15,17,23,0.92)',
    waterBottom: 'rgba(8,10,15,0.95)',
    sand: 'rgba(26,29,39,0.25)',
    sandDetail: 'rgba(42,45,58,0.15)',
    plant: 'rgba(42,45,58,0.35)',
    plantHighlight: 'rgba(90,95,120,0.20)',
    fish: [
      'rgba(108,140,255,0.25)',
      'rgba(108,140,255,0.20)',
      'rgba(128,156,255,0.20)',
      'rgba(90,95,120,0.25)',
      'rgba(150,160,180,0.20)',
    ],
    bubble: 'rgba(180,200,240,0.12)',
    bubbleHighlight: 'rgba(220,235,255,0.18)',
  };

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

  class Fish {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.size = rand(14, 26);
      this.x = rand(this.size, width - this.size);
      this.y = rand(this.size, height - this.size);
      this.speed = rand(0.12, 0.40);
      this.color = COLORS.fish[randInt(0, COLORS.fish.length - 1)];
      this.tailPhase = rand(0, Math.PI * 2);
      this.tailSpeed = rand(0.06, 0.14);
      this.direction = rand(-1, 1) > 0 ? 1 : -1;
      this.targetX = rand(this.size, width - this.size);
      this.targetY = rand(this.size, height - this.size);
      this.targetTimer = 0;
      this.targetInterval = randInt(120, 300);
      this.angle = this.direction > 0 ? 0 : Math.PI;
      this.targetAngle = this.angle;
      this.turnSpeed = 0.025;
      this.eyeSize = this.size * 0.16;
    }

    setTarget(width, height) {
      const margin = this.size * 2;
      this.targetX = rand(margin, width - margin);
      this.targetY = rand(margin, height - margin);
      this.targetTimer = 0;
      this.targetInterval = randInt(180, 400);
    }

    update(width, height) {
      this.targetTimer++;
      if (this.targetTimer > this.targetInterval) {
        this.setTarget(width, height);
      }

      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const move = Math.min(this.speed, dist);
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;

        this.targetAngle = Math.atan2(dy, dx);
        let diff = this.targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * this.turnSpeed;

        this.direction = Math.cos(this.angle) > 0 ? 1 : -1;
      }

      this.tailPhase += this.tailSpeed * (0.5 + this.speed * 0.8);

      const pad = this.size * 1.5;
      if (this.x < pad) this.x = pad;
      if (this.x > width - pad) this.x = width - pad;
      if (this.y < pad) this.y = pad;
      if (this.y > height - pad) this.y = height - pad;
    }

    draw(ctx) {
      const s = this.size;
      const angle = this.angle;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.0, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      const tailLen = s * 0.9;
      const tailWid = s * 0.55;
      const tx = -s * 0.85;
      const tailSway = Math.sin(this.tailPhase);

      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.quadraticCurveTo(
        tx - tailLen * 0.4,
        -tailWid * (0.6 + 0.4 * tailSway),
        tx - tailLen,
        -tailWid * (0.7 + 0.5 * tailSway)
      );
      ctx.quadraticCurveTo(
        tx - tailLen * 0.5,
        -tailWid * 0.2 * tailSway,
        tx - tailLen * 0.3,
        0
      );
      ctx.quadraticCurveTo(
        tx - tailLen * 0.5,
        tailWid * 0.2 * tailSway,
        tx - tailLen,
        tailWid * (0.7 + 0.5 * tailSway)
      );
      ctx.quadraticCurveTo(
        tx - tailLen * 0.4,
        tailWid * (0.6 + 0.4 * tailSway),
        tx,
        0
      );
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();

      const eyeX = s * 0.35;
      ctx.beginPath();
      ctx.arc(eyeX, -s * 0.1, this.eyeSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,215,235,0.6)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeX + this.eyeSize * 0.4, -s * 0.1 + this.eyeSize * 0.2,
              this.eyeSize * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,25,35,0.8)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.45);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.85, s * 0.4, -s * 0.45);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }
  }

  class Plant {
    constructor(width, height) {
      this.x = rand(10, width - 10);
      this.baseY = height - rand(2, 10);
      this.height = rand(height * 0.25, height * 0.50);
      this.segments = randInt(6, 12);
      this.width = rand(2, 4);
      this.phase = rand(0, Math.PI * 2);
      this.speed = rand(0.008, 0.020);
      this.amplitude = rand(3, 10);
      this.color = COLORS.plant;
      this.leafSize = rand(3, 7);
      this.leafCount = randInt(3, 5);
      this.leafPositions = [];
      for (let i = 0; i < this.leafCount; i++) {
        this.leafPositions.push(rand(0.15, 0.85));
      }
      this.leafPositions.sort((a, b) => a - b);
    }

    update(time) {
      this.phase += this.speed;
    }

    draw(ctx, width, height) {
      const seg = this.segments;
      const segH = this.height / seg;
      const amp = this.amplitude * 0.5;

      ctx.beginPath();
      ctx.moveTo(this.x, this.baseY);
      for (let i = 1; i <= seg; i++) {
        const y = this.baseY - i * segH;
        const t = i / seg;
        const wave = Math.sin(this.phase + t * 3.0 + i * 0.4) * amp * t;
        const x = this.x + wave;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.width;
      ctx.lineCap = 'round';
      ctx.stroke();

      for (const pos of this.leafPositions) {
        const idx = Math.floor(pos * seg);
        const frac = (pos * seg) - idx;
        const i = Math.min(idx + 1, seg);
        const y0 = this.baseY - (i - 1) * segH;
        const y1 = this.baseY - i * segH;
        const y = y0 + (y1 - y0) * frac;
        const t = i / seg;
        const wave = Math.sin(this.phase + t * 3.0 + i * 0.4) * amp * t;
        const x = this.x + wave;

        const side = (pos % 2 < 0.5) ? -1 : 1;
        const leafAngle = Math.sin(this.phase + pos * 2.3 + i * 0.7) * 0.4 + 0.6;
        const lSize = this.leafSize * (0.7 + 0.6 * t);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(side * leafAngle * 1.2);
        ctx.beginPath();
        ctx.ellipse(lSize * 0.6, 0, lSize, lSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5 + 0.3 * t;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-side * leafAngle * 1.2 * 0.7);
        ctx.beginPath();
        ctx.ellipse(-lSize * 0.5, 0, lSize * 0.6, lSize * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.4 + 0.3 * t;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }

  class Bubble {
    constructor(width, height) {
      this.x = rand(10, width - 10);
      this.y = height + rand(10, 40);
      this.radius = rand(3, 9);
      this.speed = rand(0.15, 0.60);
      this.wobble = rand(0.2, 0.7);
      this.phase = rand(0, Math.PI * 2);
    }

    update(width, height) {
      this.y -= this.speed;
      this.phase += 0.02;
      this.x += Math.sin(this.phase) * this.wobble * 0.25;
    }

    draw(ctx) {
      const r = this.radius;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bubble;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x - r * 0.25, this.y - r * 0.25, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bubbleHighlight;
      ctx.fill();
    }
  }

  function createAquarium(shadowRoot) {
    const canvas = shadowRoot.getElementById('aquarium-canvas');
    if (!canvas) {
      console.warn('Aquarium canvas not found');
      return null;
    }

    const ctx = canvas.getContext('2d');
    let width, height;
    const dpr = 1;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    }

    resize();

    const fish = [];
    for (let i = 0; i < 6 + randInt(0, 4); i++) {
      fish.push(new Fish(width, height));
    }

    const plants = [];
    for (let i = 0; i < 8 + randInt(0, 5); i++) {
      plants.push(new Plant(width, height));
    }

    const bubbles = [];
    const maxBubbles = 15 + randInt(0, 10);

    let frameId = null;
    let running = true;
    let time = 0;

    function animate() {
      if (!running) return;

      const newWidth = canvas.parentElement.clientWidth;
      const newHeight = canvas.parentElement.clientHeight;
      if (newWidth !== width || newHeight !== height) {
        width = newWidth;
        height = newHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
      }

      time++;

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, COLORS.waterTop);
      grad.addColorStop(1, COLORS.waterBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = COLORS.sand;
      const sandY = height - rand(2, 6);
      ctx.beginPath();
      ctx.moveTo(0, sandY);
      for (let x = 0; x <= width; x += 5) {
        const y = sandY + Math.sin(x * 0.03 + time * 0.001) * 1.2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      for (const p of plants) {
        p.update(time);
        p.draw(ctx, width, height);
      }

      for (const f of fish) {
        f.update(width, height);
        f.draw(ctx);
      }

      if (bubbles.length < maxBubbles && Math.random() < 0.015) {
        bubbles.push(new Bubble(width, height));
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.update(width, height);
        b.draw(ctx);
        if (b.y < -20) {
          bubbles.splice(i, 1);
        }
      }

      frameId = requestAnimationFrame(animate);
    }

    animate();

    return {
      stop: function() {
        running = false;
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      },
      resize: resize,
    };
  }

  window.initAnimation = function(shadowRoot) {
    return createAquarium(shadowRoot);
  };

})();