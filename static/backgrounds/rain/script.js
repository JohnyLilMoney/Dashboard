window.initAnimation = function(shadowRoot) {
    const targetCanvas = shadowRoot.querySelector('#rainCanvas');
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');

    const CONFIG = {
        DROPS_PER_SECOND: 150,
        MIN_OPACITY: 0.1,
        MAX_OPACITY: 0.4,
        MIN_WIDTH: 1.0,
        MAX_WIDTH: 3.0,
        MIN_DROP_HEIGHT: 10,
        MAX_DROP_HEIGHT: 30,
        CATCH_THRESHOLD: 0.15,
        CATCH_CHANCE: 0.2,
        HIT_ZONE_MIN: 0.0,
        HIT_ZONE_MAX: 0.9,
        COLOR_RAIN: 'rgba(180, 190, 210, ',
        COLOR_DRIP: 'rgba(180, 200, 230, ',
        COLOR_DRIP_OUTLINE: 'rgba(100, 130, 170, ',
        COLOR_BG: '#0f1117',

        DRIP_MAX_LENGTH: 50,
        DRIP_MAX_WIDTH: 4,
        DRIP_GROWTH_SPEED: 0.5,
        DRIP_SLIDE_SPEED: 0.25,
        DRIP_FADE_SPEED: 0.0005,
        DRIP_OPACITY_BOOST: -0.1,

        FALL_SPEED_MIN: 7,
        FALL_SPEED_MAX: 15,

        MIN_DELAY: 15,
        MAX_DELAY: 60,

        FLASH_MIN_PULSES: 1,
        FLASH_MAX_PULSES: 3,

        FLASH_MIN_OPACITY: 0.1,
        FLASH_MAX_OPACITY: 0.3,

        FLASH_RISE_MIN: 8,
        FLASH_RISE_MAX: 12,
        FLASH_FALL_MIN: 120,
        FLASH_FALL_MAX: 300,

        FLASH_PULSE_GAP_MIN: 25,
        FLASH_PULSE_GAP_MAX: 160,

        FLASH_COLOR_VARIANTS: [
            'rgb(225, 233, 255)',
            'rgb(210, 222, 255)',
            'rgb(236, 240, 250)',
            'rgb(215, 227, 250)'
        ]
    };

    let width, height;
    let raindrops = [];
    let drips = [];
    let animationId;
    let lastSpawnTime = null;
    let spawnAccumulator = 0;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    let flashTimer = randomBetween(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY) * 1000;
    let currentFlash = null;

    class Raindrop {
        constructor(w, h) {
            this.distance = Math.random();
            const interpolation = 1 - this.distance;

            this.opacity = CONFIG.MIN_OPACITY + (interpolation * (CONFIG.MAX_OPACITY - CONFIG.MIN_OPACITY));
            this.lineWidth = CONFIG.MIN_WIDTH + (interpolation * (CONFIG.MAX_WIDTH - CONFIG.MIN_WIDTH));

            this.x = Math.random() * w;
            this.y = -Math.random() * h;
            this.speed = CONFIG.FALL_SPEED_MIN + (interpolation * (CONFIG.FALL_SPEED_MAX - CONFIG.FALL_SPEED_MIN));
            this.len = CONFIG.MIN_DROP_HEIGHT + (Math.random() * (CONFIG.MAX_DROP_HEIGHT - CONFIG.MIN_DROP_HEIGHT));

            this.targetY = h * (CONFIG.HIT_ZONE_MIN + Math.random() * (CONFIG.HIT_ZONE_MAX - CONFIG.HIT_ZONE_MIN));
            this.hasHit = false;
        }

        update() {
            this.y += this.speed;

            if (!this.hasHit && this.y >= this.targetY) {
                this.hasHit = true;
                if (this.distance <= CONFIG.CATCH_THRESHOLD && Math.random() <= CONFIG.CATCH_CHANCE) {
                    drips.push(new Drip(this.x, this.targetY, this.opacity));
                }
            }

            if (this.y > height) return false;
            return true;
        }

        draw() {
            ctx.beginPath();
            ctx.strokeStyle = CONFIG.COLOR_RAIN + this.opacity + ')';
            ctx.lineWidth = this.lineWidth;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, this.y + this.len);
            ctx.stroke();
        }
    }

    class Drip {
        constructor(x, y, parentOpacity) {
            this.x = x;
            this.y = y;
            this.opacity = Math.min(1, parentOpacity + CONFIG.DRIP_OPACITY_BOOST);
            this.maxLen = CONFIG.DRIP_MAX_LENGTH * (0.6 + Math.random() * 0.8);
            this.maxWidth = CONFIG.DRIP_MAX_WIDTH * (0.6 + Math.random() * 0.8);
            this.currentLen = 0;
            this.growthSpeed = CONFIG.DRIP_GROWTH_SPEED * (0.7 + Math.random() * 0.6);
            this.slideSpeed = CONFIG.DRIP_SLIDE_SPEED * (0.6 + Math.random() * 0.8);
            this.fadeSpeed = CONFIG.DRIP_FADE_SPEED * (0.7 + Math.random() * 0.6);
            this.finishedGrowing = false;
        }

        update() {
            if (!this.finishedGrowing) {
                this.currentLen += this.growthSpeed;
                if (this.currentLen >= this.maxLen) {
                    this.currentLen = this.maxLen;
                    this.finishedGrowing = true;
                }
            } else {
                this.y += this.slideSpeed;
                this.opacity -= this.fadeSpeed;
            }
            return this.opacity > 0 && this.y < height + 50;
        }

        draw() {
            const progress = this.currentLen / this.maxLen;
            const w = this.maxWidth * progress * 0.5;

            ctx.save();
            ctx.globalAlpha = this.opacity;

            const bottom = this.y + this.currentLen;
            const cx = this.x;
            const cy = bottom - w * 0.8;

            ctx.beginPath();
            ctx.moveTo(cx, this.y);
            ctx.quadraticCurveTo(cx + w * 1.4, this.y + this.currentLen * 0.2, cx + w, cy);
            ctx.quadraticCurveTo(cx + w * 1.6, cy + w * 0.4, cx + w, bottom);
            ctx.quadraticCurveTo(cx, bottom + w * 0.6, cx - w, bottom);
            ctx.quadraticCurveTo(cx - w * 1.6, cy + w * 0.4, cx - w, cy);
            ctx.quadraticCurveTo(cx - w * 1.4, this.y + this.currentLen * 0.2, cx, this.y);
            ctx.closePath();

            const baseColor = CONFIG.COLOR_DRIP.replace('rgba(', '').replace(')', '').split(',').slice(0,3).join(',');
            ctx.fillStyle = 'rgba(' + baseColor + ',1)';
            ctx.fill();

            const outlineColor = CONFIG.COLOR_DRIP_OUTLINE.replace('rgba(', '').replace(')', '').split(',').slice(0,3).join(',');
            ctx.strokeStyle = 'rgba(' + outlineColor + ',0.3)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();
        }
    }

    class Flash {
        constructor() {
            this.pulses = this._buildPulses();
            this.totalDuration = this.pulses.length
                ? this.pulses[this.pulses.length - 1].fallEnd
                : 0;
            this.elapsed = 0;
            this.tint = CONFIG.FLASH_COLOR_VARIANTS[
                Math.floor(Math.random() * CONFIG.FLASH_COLOR_VARIANTS.length)
            ];
        }

        _buildPulses() {
            const count = Math.floor(randomBetween(
                CONFIG.FLASH_MIN_PULSES, CONFIG.FLASH_MAX_PULSES + 1
            ));

            const pulses = [];
            let cursor = 0;

            for (let i = 0; i < count; i++) {
                const gap = i === 0 ? 0 : randomBetween(CONFIG.FLASH_PULSE_GAP_MIN, CONFIG.FLASH_PULSE_GAP_MAX);
                const rise = randomBetween(CONFIG.FLASH_RISE_MIN, CONFIG.FLASH_RISE_MAX);
                const fall = randomBetween(CONFIG.FLASH_FALL_MIN, CONFIG.FLASH_FALL_MAX);
                let peak = randomBetween(CONFIG.FLASH_MIN_OPACITY, CONFIG.FLASH_MAX_OPACITY);

                const riseStart = cursor + gap;
                const peakTime = riseStart + rise;
                const fallEnd = peakTime + fall;

                pulses.push({ riseStart, peakTime, fallEnd, peak });
                cursor = fallEnd;
            }

            if (pulses.length > 1) {
                pulses[0].peak = Math.min(1, pulses[0].peak * 1.2);
                for (let i = 1; i < pulses.length; i++) {
                    pulses[i].peak *= 0.4 + Math.random() * 0.4;
                }
            }

            return pulses;
        }

        update(deltaTime) {
            this.elapsed += deltaTime;
            return this.elapsed < this.totalDuration;
        }

        _currentOpacity() {
            for (const pulse of this.pulses) {
                if (this.elapsed < pulse.riseStart || this.elapsed > pulse.fallEnd) continue;
                if (this.elapsed <= pulse.peakTime) {
                    const progress = (this.elapsed - pulse.riseStart) / (pulse.peakTime - pulse.riseStart || 1);
                    return pulse.peak * progress;
                }
                const progress = (this.elapsed - pulse.peakTime) / (pulse.fallEnd - pulse.peakTime || 1);
                return pulse.peak * (1 - progress);
            }
            return 0;
        }

        draw() {
            const opacity = this._currentOpacity();
            if (opacity <= 0) return;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = opacity;
            ctx.fillStyle = this.tint;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
    }

    function resize() {
        width = targetCanvas.clientWidth;
        height = targetCanvas.clientHeight;
        targetCanvas.width = width;
        targetCanvas.height = height;
    }

    function animate(timestamp) {
        if (lastSpawnTime === null) lastSpawnTime = timestamp;
        const deltaTime = timestamp - lastSpawnTime;
        lastSpawnTime = timestamp;

        ctx.fillStyle = CONFIG.COLOR_BG;
        ctx.fillRect(0, 0, width, height);

        spawnAccumulator += CONFIG.DROPS_PER_SECOND / 60;
        while (spawnAccumulator >= 1) {
            raindrops.push(new Raindrop(width, height));
            spawnAccumulator -= 1;
        }
        
        for (let i = raindrops.length - 1; i >= 0; i--) {
            if (!raindrops[i].update()) {
                raindrops.splice(i, 1);
            } else {
                raindrops[i].draw();
            }
        }

        for (let i = drips.length - 1; i >= 0; i--) {
            if (!drips[i].update()) {
                drips.splice(i, 1);
            } else {
                drips[i].draw();
            }
        }

        if (currentFlash) {
            const stillGoing = currentFlash.update(deltaTime);
            currentFlash.draw();
            if (!stillGoing) {
                currentFlash = null;
                flashTimer = randomBetween(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY) * 1000;
            }
        } else {
            flashTimer -= deltaTime;
            if (flashTimer <= 0) {
                currentFlash = new Flash();
            }
        }

        animationId = requestAnimationFrame(animate);
    }

    const resizeHandler = () => resize();
    window.addEventListener('resize', resizeHandler);
    resize();

    animationId = requestAnimationFrame(animate);

    return {
        destroy: () => {
            window.removeEventListener('resize', resizeHandler);
            cancelAnimationFrame(animationId);
        },
        stop: () => {
            raindrops = [];
            drips = [];
        }
    };
};
