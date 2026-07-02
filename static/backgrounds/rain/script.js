window.initAnimation = function(shadowRoot) {
    const targetCanvas = shadowRoot.querySelector('#rainCanvas');
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');

    const CONFIG = {
        DROPS_PER_SECOND: 120,
        MIN_OPACITY: 0.1,
        MAX_OPACITY: 0.4,
        MIN_WIDTH: 1.0,
        MAX_WIDTH: 3.0,
        MIN_DROP_HEIGHT: 10,
        MAX_DROP_HEIGHT: 30,
        CATCH_THRESHOLD: 0.15,
        CATCH_CHANCE: 0.1,
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
        FALL_SPEED_MAX: 15
    };

    let width, height;
    let raindrops = [];
    let drips = [];
    let animationId;
    let lastSpawnTime = 0;
    let spawnAccumulator = 0;

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

    function resize() {
        width = targetCanvas.clientWidth;
        height = targetCanvas.clientHeight;
        targetCanvas.width = width;
        targetCanvas.height = height;
    }

    function animate(timestamp) {
        ctx.fillStyle = CONFIG.COLOR_BG;
        ctx.fillRect(0, 0, width, height);

        const deltaTime = timestamp - lastSpawnTime;
        lastSpawnTime = timestamp;

        spawnAccumulator += deltaTime * (CONFIG.DROPS_PER_SECOND / 1000);
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
