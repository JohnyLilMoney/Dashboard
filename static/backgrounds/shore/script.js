window.initAnimation = function(shadowRoot) {
    const canvas = document.createElement('canvas');
    canvas.id = 'waveCanvas';
    shadowRoot.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let W, H, horizonY;
    const sun = { x: 0, y: 0, radius: 0 };
    let waves = [];
    let animId = null;
    let frame = 0;

    const REFLECTION_THRESHOLD = 0.75;
    let spreadFactor = 0;
    let baseSpread = 0;

    const HORIZON_FRACTION = 0.62;
    const WAVE_COUNT = 15;
    const MIN_SPEED = 0.25;
    const MAX_SPEED = 1.4;
    const MIN_AMPLITUDE = 3;
    const MAX_AMPLITUDE = 28;
    const MIN_FREQUENCY = 0.01;
    const MAX_FREQUENCY = 0.03;
    const Y_JITTER = 0.03;
    const WAVE_COLOR = { r: 22, g: 25, b: 34, a: 0.32 };

    class Wave {
        constructor(color, amplitude, frequency, speed, yOffset) {
            this.color = color;
            this.amplitude = amplitude;
            this.frequency = frequency;
            this.speed = speed;
            this.yOffset = yOffset;
            this.phase = 0;
        }
        draw() {
            const baseY = this.yOffset * H;
            ctx.beginPath();
            ctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 2) {
                const y = baseY + Math.sin(x * this.frequency + this.phase) * this.amplitude;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
            this.phase += this.speed;
        }
    }

    function drawSky() {
        const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0, '#0a0c18');
        grad.addColorStop(0.35, '#141b2e');
        grad.addColorStop(0.65, '#2a1f2e');
        grad.addColorStop(0.85, '#4d2a2a');
        grad.addColorStop(1, '#7a4530');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, horizonY);
        const haze = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY);
        haze.addColorStop(0, 'rgba(180, 120, 80, 0)');
        haze.addColorStop(0.5, 'rgba(200, 140, 100, 0.12)');
        haze.addColorStop(1, 'rgba(220, 160, 120, 0.25)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, horizonY - 60, W, 60);
    }

    function drawSun() {
        const glowRadius = sun.radius * 5.5;
        const grad = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, glowRadius);
        grad.addColorStop(0, 'rgba(255, 200, 130, 0.85)');
        grad.addColorStop(0.15, 'rgba(255, 180, 110, 0.45)');
        grad.addColorStop(0.4, 'rgba(255, 150, 90, 0.18)');
        grad.addColorStop(0.7, 'rgba(255, 120, 70, 0.05)');
        grad.addColorStop(1, 'rgba(255, 100, 60, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const innerGlow = sun.radius * 2.2;
        const grad2 = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, innerGlow);
        grad2.addColorStop(0, 'rgba(255, 220, 160, 0.9)');
        grad2.addColorStop(0.5, 'rgba(255, 190, 130, 0.4)');
        grad2.addColorStop(1, 'rgba(255, 160, 100, 0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, innerGlow, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, horizonY);
        ctx.clip();
        const grad3 = ctx.createRadialGradient(
            sun.x - sun.radius * 0.2, sun.y - sun.radius * 0.2, 0,
            sun.x, sun.y, sun.radius
        );
        grad3.addColorStop(0, '#fff8e8');
        grad3.addColorStop(0.3, '#ffe8c0');
        grad3.addColorStop(0.7, '#ffcc88');
        grad3.addColorStop(1, '#ffa866');
        ctx.fillStyle = grad3;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const horizGlow = ctx.createLinearGradient(sun.x - W * 0.3, horizonY, sun.x + W * 0.3, horizonY);
        horizGlow.addColorStop(0, 'rgba(255, 150, 80, 0)');
        horizGlow.addColorStop(0.5, 'rgba(255, 200, 140, 0.18)');
        horizGlow.addColorStop(1, 'rgba(255, 150, 80, 0)');
        ctx.fillStyle = horizGlow;
        ctx.fillRect(0, horizonY - 8, W, 16);
    }

    function drawReflection() {
        for (let w = 0; w < waves.length; w++) {
            const wave = waves[w];
            const baseY = wave.yOffset * H;
            const freq = wave.frequency;
            const amp = wave.amplitude;
            const phase = wave.phase;

            for (let x = 0; x <= W; x += 2) {
                const sineVal = Math.sin(x * freq + phase);
                if (sineVal > -REFLECTION_THRESHOLD) continue;

                const y = baseY + sineVal * amp;
                if (y < horizonY) continue;

                const halfWidth = baseSpread + (y - horizonY) * spreadFactor;
                const left = sun.x - halfWidth;
                const right = sun.x + halfWidth;
                if (x < left || x > right) continue;

                const intensity = (-sineVal - REFLECTION_THRESHOLD) / (1 - REFLECTION_THRESHOLD);
                const alpha = 0.5 + intensity * 0.5;
                const radius = 3 + intensity * 4;

                ctx.save();
                ctx.shadowColor = `rgba(255, 220, 150, ${alpha * 0.6})`;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 230, ${alpha})`;
                ctx.fill();
                ctx.restore();

                ctx.beginPath();
                ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
                ctx.fill();
            }
        }
    }

    function generateWaves() {
        const generated = [];
        const color = `rgba(${WAVE_COLOR.r}, ${WAVE_COLOR.g}, ${WAVE_COLOR.b}, ${WAVE_COLOR.a})`;

        for (let i = 0; i < WAVE_COUNT; i++) {
            const t = WAVE_COUNT > 1 ? i / (WAVE_COUNT - 1) : 0;

            let yOffset = HORIZON_FRACTION + t * (1 - HORIZON_FRACTION);
            yOffset += (Math.random() - 0.5) * Y_JITTER;

            const amplitude = MIN_AMPLITUDE + t * (MAX_AMPLITUDE - MIN_AMPLITUDE);
            const frequency = MIN_FREQUENCY + t * (MAX_FREQUENCY - MIN_FREQUENCY);
            const pixelSpeed = MIN_SPEED + t * (MAX_SPEED - MIN_SPEED);
            const speed = pixelSpeed * frequency;

            const wave = new Wave(color, amplitude, frequency, speed, yOffset);
            wave.phase = Math.random() * Math.PI * 2;
            generated.push(wave);
        }
        return generated;
    }

    function init() {
        W = canvas.width = shadowRoot.clientWidth || window.innerWidth;
        H = canvas.height = shadowRoot.clientHeight || window.innerHeight;
        horizonY = H * HORIZON_FRACTION;
        sun.x = W * 0.5;
        sun.y = horizonY;
        sun.radius = Math.max(30, Math.min(48, W * 0.04));

        const maxHalfWidth = W * 0.14;
        baseSpread = W * 0.04;
        spreadFactor = (maxHalfWidth - baseSpread) / (H - horizonY);

        waves = generateWaves();
    }

    function animate() {
        frame++;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0f1117';
        ctx.fillRect(0, 0, W, H);

        drawSky();
        drawSun();
        waves.forEach(wave => wave.draw());
        drawReflection();

        animId = requestAnimationFrame(animate);
    }

    function onResize() {
        if (animId) cancelAnimationFrame(animId);
        init();
        frame = 0;
        animate();
    }

    window.addEventListener('resize', onResize);
    init();
    animate();

    return {
        stop: function() {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
        },
        resize: onResize
    };
};
