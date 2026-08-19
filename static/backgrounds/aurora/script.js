window.initAnimation = function(shadowRoot) {
    const canvas = document.createElement('canvas');
    canvas.id = 'aurora-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    shadowRoot.appendChild(canvas);
    const bgCtx = canvas.getContext('2d');

    const auroraCanvas = document.createElement('canvas');
    auroraCanvas.id = 'aurora-layer';
    auroraCanvas.style.position = 'absolute';
    auroraCanvas.style.top = '0';
    auroraCanvas.style.left = '0';
    auroraCanvas.style.width = '100%';
    auroraCanvas.style.height = '100%';
    auroraCanvas.style.pointerEvents = 'none';
    auroraCanvas.style.filter = 'blur(10px)';
    auroraCanvas.style.opacity = '0.9';
    shadowRoot.appendChild(auroraCanvas);
    const auroraCtx = auroraCanvas.getContext('2d');

    let W, H;
    let animId = null;
    let running = true;
    let frameCount = 0;
    let time = 0;
    let lastTime = performance.now();

    const SKY_TOP = '#04050a';
    const SKY_HORIZON = '#0a0e1a';
    const TERRAIN_COLOR = '#030407';
    const HORIZON_Y_FRACTION = 0.78;

    const GRADIENT_STOPS = [
        { stop: 0,    r: 40,  g: 230, b: 120 },
        { stop: 0.45, r: 150, g: 235, b: 170 },
        { stop: 0.6,  r: 235, g: 235, b: 225 },
        { stop: 0.8,  r: 210, g: 140, b: 220 },
        { stop: 1,    r: 175, g: 70,  b: 210 }
    ];

    const SHEET_COUNT = 3;
    const GLOW_OPACITY = 0.22;
    const CORE_OPACITY = 0.36;
    const RAY_OPACITY = 0.2;
    const EDGE_SEGMENTS = 56;
    const RAY_COLUMNS = 30;
    const FRINGE_COUNT = 8;

    let sheets = [];
    let starPositions = [];

    function sampleGradientColor(t) {
        t = Math.max(0, Math.min(1, t));
        for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
            const a = GRADIENT_STOPS[i];
            const b = GRADIENT_STOPS[i + 1];
            if (t >= a.stop && t <= b.stop) {
                const localT = (t - a.stop) / (b.stop - a.stop || 1);
                return {
                    r: a.r + (b.r - a.r) * localT,
                    g: a.g + (b.g - a.g) * localT,
                    b: a.b + (b.b - a.b) * localT
                };
            }
        }
        const last = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
        return { r: last.r, g: last.g, b: last.b };
    }

    class AuroraSheet {
        constructor(index) {
            this.index = index;
            this.baseY = H * (0.1 + index * 0.16 + Math.random() * 0.05);
            this.thickness = H * (0.16 + Math.random() * 0.1);
            this.opacityScale = 0.7 + Math.random() * 0.5;

            this.topTerms = this.randomTerms();
            this.bottomTerms = this.randomTerms();

            this.flowSpeed = 0.22 + Math.random() * 0.3;
            this.flowPhase = Math.random() * Math.PI * 2;
            this.bobSpeed = 0.25 + Math.random() * 0.2;
            this.bobPhase = Math.random() * Math.PI * 2;
            this.bobAmount = H * 0.03;

            this.curveFreq = 0.8 + Math.random() * 1.4;
            this.curveAmp = H * (0.02 + Math.random() * 0.06);
            this.curvePhase = Math.random() * Math.PI * 2;
            this.curveSpeed = 0.1 + Math.random() * 0.2;

            this.envFreq = 1.5 + Math.random() * 2.5;
            this.envPhase = Math.random() * Math.PI * 2;
            this.envSpeed = 0.08 + Math.random() * 0.12;

            this.rays = [];
            for (let i = 0; i < RAY_COLUMNS; i++) {
                this.rays.push({
                    xFrac: Math.random(),
                    width: 1 + Math.random() * 3,
                    speed: 0.4 + Math.random() * 0.8,
                    phase: Math.random() * Math.PI * 2,
                    baseAlpha: 0.3 + Math.random() * 0.7
                });
            }

            this.fringes = [];
            for (let i = 0; i < FRINGE_COUNT; i++) {
                this.fringes.push({
                    side: Math.random() < 0.5 ? 'top' : 'bottom',
                    xFrac: Math.random(),
                    xSpread: 0.03 + Math.random() * 0.07,
                    reach: H * (0.02 + Math.random() * 0.06),
                    speed: 0.3 + Math.random() * 0.5,
                    phase: Math.random() * Math.PI * 2,
                    driftSpeed: 0.04 + Math.random() * 0.06,
                    driftPhase: Math.random() * Math.PI * 2
                });
            }
        }

        randomTerms() {
            const terms = [];
            const freqMultipliers = [1.3, 2.7, 4.1, 6.3, 9.1];
            const ampMultipliers = [0.035, 0.02, 0.012, 0.007, 0.004];

            for (let i = 0; i < freqMultipliers.length; i++) {
                terms.push({
                    freq: freqMultipliers[i] + Math.random() * 0.4,
                    baseAmp: H * ampMultipliers[i] * (0.7 + Math.random() * 0.6),
                    breathe: 0.4 + Math.random() * 0.4,
                    breatheSpeed: 0.1 + Math.random() * 0.12,
                    phase: Math.random() * Math.PI * 2,
                    phaseSpeed: 1.0 + Math.random() * 1.0
                });
            }
            return terms;
        }

        resize(scaleX, scaleY) {
            this.baseY *= scaleY;
            this.thickness *= scaleY;
            this.bobAmount *= scaleY;
            this.curveAmp *= scaleY;

            this.topTerms.forEach(term => term.baseAmp *= scaleY);
            this.bottomTerms.forEach(term => term.baseAmp *= scaleY);

            this.fringes.forEach(f => f.reach *= scaleY);
            this.rays.forEach(r => r.width *= scaleX);
        }

        edgeY(baseY, terms, xFrac, t) {
            const warp = 0.07 * Math.sin(xFrac * 2.3 + t * 0.15) + 0.04 * Math.sin(xFrac * 5.1 - t * 0.22);
            const xWarped = xFrac + warp;

            let y = baseY;
            for (const term of terms) {
                const amp = term.baseAmp * (1 - term.breathe / 2 + term.breathe / 2 * Math.sin(t * term.breatheSpeed + term.phase * 1.7));
                y += Math.sin(xWarped * Math.PI * term.freq + term.phase + t * this.flowSpeed * term.phaseSpeed) * amp;
            }
            return y;
        }

        buildPath(t, inflate) {
            const bob = Math.sin(this.bobPhase + t * this.bobSpeed) * this.bobAmount;
            const topPts = [];
            const bottomPts = [];
            let minY = Infinity, maxY = -Infinity;

            for (let i = 0; i <= EDGE_SEGMENTS; i++) {
                const xFrac = i / EDGE_SEGMENTS;
                const x = xFrac * W;

                const centerShift =
                    Math.sin(xFrac * Math.PI * this.curveFreq + this.curvePhase + t * this.curveSpeed) * this.curveAmp * 0.7 +
                    Math.sin(xFrac * Math.PI * this.curveFreq * 2.7 + this.curvePhase * 1.3 - t * this.curveSpeed * 1.4) * this.curveAmp * 0.3;

                const thicknessMult = 0.55 + 0.45 * Math.sin(xFrac * Math.PI * this.envFreq + this.envPhase + t * this.envSpeed);
                const halfThick = (this.thickness / 2 + inflate) * thicknessMult;

                const topY = this.edgeY(this.baseY + centerShift - halfThick, this.topTerms, xFrac, t) + bob;
                const botY = this.edgeY(this.baseY + centerShift + halfThick, this.bottomTerms, xFrac, t) + bob;

                topPts.push({ x, y: topY });
                bottomPts.push({ x, y: botY });
                minY = Math.min(minY, topY);
                maxY = Math.max(maxY, botY);
            }

            const path = new Path2D();
            path.moveTo(topPts[0].x, topPts[0].y);
            for (let i = 1; i < topPts.length; i++) path.lineTo(topPts[i].x, topPts[i].y);
            for (let i = bottomPts.length - 1; i >= 0; i--) path.lineTo(bottomPts[i].x, bottomPts[i].y);
            path.closePath();

            return { path, minY: Math.max(0, minY), maxY: Math.min(H * HORIZON_Y_FRACTION, maxY), topPts, bottomPts };
        }

        gradientForRange(minY, maxY, opacityMult, targetCtx) {
            const grad = targetCtx.createLinearGradient(0, minY, 0, maxY);
            const steps = 10;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const c = sampleGradientColor(t);
                const edgeFade = Math.pow(Math.sin(Math.PI * t), 1.6);
                const alpha = opacityMult * edgeFade;
                grad.addColorStop(t, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`);
            }
            return grad;
        }

        drawFringes(ctx, t, minY, maxY, topPts, bottomPts) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const f of this.fringes) {
                const pts = f.side === 'top' ? topPts : bottomPts;
                const idx = Math.min(pts.length - 1, Math.floor(f.xFrac * pts.length));
                const anchor = pts[idx];
                const drift = Math.sin(f.driftPhase + t * f.driftSpeed) * f.xSpread * W;
                const stretch = 0.5 + 0.5 * Math.sin(f.phase + t * f.speed);
                const len = f.reach * (0.4 + stretch);
                const cx = anchor.x + drift;
                const cy = f.side === 'top' ? anchor.y - len * 0.5 : anchor.y + len * 0.5;

                const c = sampleGradientColor(f.side === 'top' ? 0 : 1);
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
                const alpha = RAY_OPACITY * this.opacityScale * (0.4 + 0.6 * stretch);
                grad.addColorStop(0, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`);
                grad.addColorStop(1, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},0)`);

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(cx, cy, len * 0.5, len, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        draw(ctx, t) {
            const glowInfo = this.buildPath(t, H * 0.03);
            if (glowInfo.minY < glowInfo.maxY) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = this.gradientForRange(glowInfo.minY, glowInfo.maxY, GLOW_OPACITY * this.opacityScale, ctx);
                ctx.fill(glowInfo.path);
                ctx.restore();
            }

            const coreInfo = this.buildPath(t, 0);
            if (coreInfo.minY >= coreInfo.maxY) return;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = this.gradientForRange(coreInfo.minY, coreInfo.maxY, CORE_OPACITY * this.opacityScale, ctx);
            ctx.fill(coreInfo.path);
            ctx.restore();

            ctx.save();
            ctx.clip(coreInfo.path);
            ctx.globalCompositeOperation = 'lighter';
            for (const ray of this.rays) {
                const shimmer = 0.5 + 0.5 * Math.sin(ray.phase + t * ray.speed);
                const x = ray.xFrac * W;
                const c = sampleGradientColor(0.5);
                const alpha = RAY_OPACITY * this.opacityScale * ray.baseAlpha * shimmer;
                ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
                ctx.fillRect(x - ray.width / 2, coreInfo.minY, ray.width, coreInfo.maxY - coreInfo.minY);
                ctx.fillStyle = `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`;
                ctx.fillRect(x - ray.width, coreInfo.minY, ray.width * 2, coreInfo.maxY - coreInfo.minY);
            }
            ctx.restore();

            this.drawFringes(ctx, t, coreInfo.minY, coreInfo.maxY, coreInfo.topPts, coreInfo.bottomPts);
        }
    }

    function generateSheets() {
        const out = [];
        for (let i = 0; i < SHEET_COUNT; i++) out.push(new AuroraSheet(i));
        return out;
    }

    function generateStars() {
        const out = [];
        const count = Math.floor((W * H) / 9000);
        for (let i = 0; i < count; i++) {
            out.push({
                x: Math.random() * W,
                y: Math.random() * H * HORIZON_Y_FRACTION * 0.9,
                size: Math.random() < 0.85 ? 1 : 2,
                a: 0.3 + Math.random() * 0.7,
                seed: Math.random() * Math.PI * 2
            });
        }
        return out;
    }

    function drawSky() {
        const grad = bgCtx.createLinearGradient(0, 0, 0, H * HORIZON_Y_FRACTION);
        grad.addColorStop(0, SKY_TOP);
        grad.addColorStop(1, SKY_HORIZON);
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, W, H);
    }

    function drawStars() {
        bgCtx.save();
        for (let i = 0; i < starPositions.length; i++) {
            const s = starPositions[i];
            bgCtx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(frameCount * 0.01 + s.seed));
            bgCtx.fillStyle = '#ffffff';
            bgCtx.fillRect(s.x, s.y, s.size, s.size);
        }
        bgCtx.restore();
    }

    function drawTerrain() {
        const baseY = H * HORIZON_Y_FRACTION;
        bgCtx.beginPath();
        bgCtx.moveTo(0, H);
        bgCtx.lineTo(0, baseY + H * 0.02);
        const segments = 10;
        for (let i = 0; i <= segments; i++) {
            const x = (W / segments) * i;
            const jag = Math.sin(i * 1.7 + 3.1) * H * 0.015 + Math.sin(i * 0.6) * H * 0.01;
            bgCtx.lineTo(x, baseY + H * 0.02 + jag);
        }
        bgCtx.lineTo(W, H);
        bgCtx.closePath();
        bgCtx.fillStyle = TERRAIN_COLOR;
        bgCtx.fill();

        const edgeGrad = bgCtx.createLinearGradient(0, baseY - H * 0.02, 0, baseY + H * 0.04);
        edgeGrad.addColorStop(0, 'rgba(120,180,255,0)');
        edgeGrad.addColorStop(0.5, 'rgba(120,180,255,0.06)');
        edgeGrad.addColorStop(1, 'rgba(120,180,255,0)');
        bgCtx.fillStyle = edgeGrad;
        bgCtx.fillRect(0, baseY - H * 0.02, W, H * 0.06);
    }

    function resizeCanvas() {
        const rect = shadowRoot.host.getBoundingClientRect();
        W = Math.round(rect.width);
        H = Math.round(rect.height);
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        auroraCanvas.width = W;
        auroraCanvas.height = H;
        auroraCanvas.style.width = W + 'px';
        auroraCanvas.style.height = H + 'px';
    }

    function scaleStarPositions(scaleX, scaleY) {
        starPositions.forEach(s => {
            s.x *= scaleX;
            s.y *= scaleY;
        });
    }

    function handleResize() {
        const rect = shadowRoot.host.getBoundingClientRect();
        const newW = Math.round(rect.width);
        const newH = Math.round(rect.height);
        if (newW !== W || newH !== H) {
            const scaleX = W > 0 ? newW / W : 1;
            const scaleY = H > 0 ? newH / H : 1;
            resizeCanvas();
            sheets.forEach(sheet => sheet.resize(scaleX, scaleY));
            scaleStarPositions(scaleX, scaleY);
        }
    }

    function initObjects() {
        sheets = generateSheets();
        starPositions = generateStars();
    }

    function animate(now) {
        if (!running) return;

        const delta = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        time += delta;

        handleResize();

        bgCtx.clearRect(0, 0, W, H);
        drawSky();
        drawStars();
        drawTerrain();

        auroraCtx.clearRect(0, 0, W, H);
        sheets.forEach(s => s.draw(auroraCtx, time));

        frameCount++;
        animId = requestAnimationFrame(animate);
    }

    resizeCanvas();
    initObjects();
    animId = requestAnimationFrame(animate);

    return {
        stop: function() {
            running = false;
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
            bgCtx.clearRect(0, 0, W, H);
            auroraCtx.clearRect(0, 0, W, H);
            sheets = [];
        },
        resize: handleResize
    };
};
