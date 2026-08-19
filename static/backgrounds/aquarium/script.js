(function() {
  'use strict';

  const COLORS = {
    waterTop: '#0f1117',
    waterBottom: '#080a0f',
    plant1: '#0d1a0d',
    plant2: '#142214',
    plant3: '#1a2a1a',
    fish: [
      'rgba(74,106,175,0.65)',
      'rgba(58,122,122,0.60)',
      'rgba(106,90,138,0.55)',
      'rgba(90,122,106,0.60)',
      'rgba(122,106,90,0.55)',
      'rgba(74,106,175,0.50)',
    ],
    bubble: 'rgba(180,200,240,0.25)',
    bubbleHighlight: 'rgba(220,235,255,0.35)',
    sand: '#11151a',
    sandDetail: '#161b22',
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

  class Fish {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.size = rand(12, 24);
      this.x = rand(this.size, width - this.size);
      this.y = rand(this.size, height - this.size);
      this.speed = rand(0.15, 0.45);
      this.color = COLORS.fish[randInt(0, COLORS.fish.length - 1)];
      this.tailPhase = rand(0, Math.PI * 2);
      this.tailSpeed = rand(0.05, 0.12);
      this.direction = rand(-1, 1) > 0 ? 1 : -1;

      this.targetX = rand(this.size, width - this.size);
      this.targetY = rand(this.size, height - this.size);
      this.targetTimer = 0;
      this.targetInterval = randInt(120, 300);

      this.angle = this.direction > 0 ? 0 : Math.PI;
      this.targetAngle = this.angle;
      this.turnSpeed = 0.025;
      this.eyeSize = this.size * 0.18;
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
      const tailAngle = Math.sin(this.tailPhase) * 0.45;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.0, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      const tailLen = s * 0.8;
      const tailWid = s * 0.45;
      const tx = s * 0.85;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.quadraticCurveTo(
        tx + tailLen * 0.5,
        -tailWid * (0.7 + 0.3 * Math.sin(this.tailPhase + 0.2)),
        tx + tailLen,
        -tailWid * (0.8 + 0.4 * Math.sin(this.tailPhase + 0.4))
      );
      ctx.quadraticCurveTo(
        tx + tailLen * 0.5,
        -tailWid * 0.2 * Math.sin(this.tailPhase + 0.1),
        tx + tailLen * 0.2,
        0
      );
      ctx.quadraticCurveTo(
        tx + tailLen * 0.5,
        tailWid * 0.2 * Math.sin(this.tailPhase + 0.1),
        tx + tailLen,
        tailWid * (0.8 + 0.4 * Math.sin(this.tailPhase + 0.4))
      );
      ctx.quadraticCurveTo(
        tx + tailLen * 0.5,
        tailWid * (0.7 + 0.3 * Math.sin(this.tailPhase + 0.2)),
        tx,
        0
      );
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();

      const eyeX = s * 0.35 * (this.direction > 0 ? 1 : -1);
      ctx.beginPath();
      ctx.arc(eyeX, -s * 0.12, this.eyeSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,215,235,0.7)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        eyeX + this.eyeSize * 0.4 * (this.direction > 0 ? 1 : -1),
        -s * 0.12 + this.eyeSize * 0.2,
        this.eyeSize * 0.45,
        0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(20,25,35,0.85)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.45);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.8, s * 0.55, -s * 0.45);
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
      this.baseY = height - rand(2, 12);
      this.height = rand(height * 0.25, height * 0.55);
      this.segments = randInt(6, 14);
      this.width = rand(2, 5);
      this.phase = rand(0, Math.PI * 2);
      this.speed = rand(0.008, 0.025);
      this.amplitude = rand(4, 14);
      const plantColors = [COLORS.plant1, COLORS.plant2, COLORS.plant3];
      this.color = plantColors[randInt(0, plantColors.length - 1)];
      this.leafSize = rand(3, 8);
      this.leafCount = randInt(3, 6);
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
        ctx.ellipse(lSize * 0.6, 0, lSize, lSize * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.7 + 0.3 * t;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-side * leafAngle * 1.2 * 0.7);
        ctx.beginPath();
        ctx.ellipse(-lSize * 0.5, 0, lSize * 0.7, lSize * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5 + 0.3 * t;
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
      this.radius = rand(3, 10);
      this.speed = rand(0.2, 0.7);
      this.wobble = rand(0.2, 0.8);
      this.phase = rand(0, Math.PI * 2);
      this.life = 0;
    }

    update(width, height) {
      this.y -= this.speed;
      this.phase += 0.02;
      this.x += Math.sin(this.phase) * this.wobble * 0.3;
      this.life++;
    }

    draw(ctx) {
      const r = this.radius;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bubble;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x - r * 0.25, this.y - r * 0.25, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bubbleHighlight;
      ctx.fill();
    }
  }

  function createAquarium(shadowRoot) {
    const canvas = shadowRoot.getElementById('aquarium-canvas');
    if (!canvas) {
      console.warn('Aquarium canvas not found in shadowRoot');
      return null;
    }

    const ctx = canvas.getContext('2d');

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    let dpr = 1;

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

    const fishCount = 6 + randInt(0, 4);
    const fish = [];
    for (let i = 0; i < fishCount; i++) {
      fish.push(new Fish(width, height));
    }

    const plantCount = 8 + randInt(0, 6);
    const plants = [];
    for (let i = 0; i < plantCount; i++) {
      plants.push(new Plant(width, height));
    }

    const bubbles = [];
    const maxBubbles = 20 + randInt(0, 15);

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
      const sandY = height - rand(2, 8);
      ctx.beginPath();
      ctx.moveTo(0, sandY);
      for (let x = 0; x <= width; x += 5) {
        const y = sandY + Math.sin(x * 0.03 + time * 0.001) * 1.5;
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

      if (bubbles.length < maxBubbles && Math.random() < 0.02) {
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

    resize();
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