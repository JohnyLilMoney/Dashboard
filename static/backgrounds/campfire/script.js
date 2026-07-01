window.initAnimation = function(shadowRoot) {
    const canvas = shadowRoot.querySelector('#campfire-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let animationId = null;
    let time = 0;
    
    let smokeParticles = [];
    let emberParticles = [];
    let flameParticles = [];
    
    const config = {
        smokeCount: 20,
        emberCount: 10,
        flameCount: 25,
        fireBaseX: 0.32,
        fireBaseY: 0.85,
        fireWidth: 0.06,
        smokeMaxLifetime: 150,
        emberMaxLifetime: 100,
    };
    
    function resize() {
        const rect = shadowRoot.host.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
    }
    
    class SmokeParticle {
        constructor() {
            this.reset();
        }
        
        reset() {
            const fireX = width * config.fireBaseX;
            const fireY = height * config.fireBaseY;
            const fireWidth = width * config.fireWidth;
            
            this.x = fireX + (Math.random() - 0.5) * fireWidth * 0.5;
            this.y = fireY - Math.random() * 10;
            this.size = Math.random() * 40 + 20;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = -(Math.random() * 0.5 + 0.2);
            this.lifetime = 0;
            this.maxLifetime = config.smokeMaxLifetime + Math.random() * 40;
            this.opacity = 0;
            this.drift = Math.random() * 0.015;
            this.driftDirection = Math.random() > 0.5 ? 1 : -1;
        }
        
        update() {
            this.lifetime++;
            this.x += this.speedX + Math.sin(this.lifetime * this.drift) * 0.15 * this.driftDirection;
            this.y += this.speedY;
            this.size *= 1.002;
            this.speedX += (Math.random() - 0.5) * 0.01;
            
            const lifeRatio = this.lifetime / this.maxLifetime;
            if (lifeRatio < 0.15) {
                this.opacity = lifeRatio / 0.15;
            } else if (lifeRatio > 0.7) {
                this.opacity = 1 - (lifeRatio - 0.7) / 0.3;
            } else {
                this.opacity = 1;
            }
            
            this.opacity *= 0.4;
            
            if (this.lifetime > this.maxLifetime || this.y < -50) {
                this.reset();
                this.lifetime = 0;
            }
        }
        
        draw() {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.size
            );
            gradient.addColorStop(0, `rgba(139, 144, 160, ${this.opacity * 0.2})`);
            gradient.addColorStop(0.6, `rgba(100, 105, 125, ${this.opacity * 0.12})`);
            gradient.addColorStop(1, 'rgba(15, 17, 23, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    class EmberParticle {
        constructor() {
            this.reset();
        }
        
        reset() {
            const fireX = width * config.fireBaseX;
            const fireY = height * config.fireBaseY;
            const fireWidth = width * config.fireWidth;
            
            this.x = fireX + (Math.random() - 0.5) * fireWidth;
            this.y = fireY - Math.random() * 20;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 1.5;
            this.speedY = -(Math.random() * 1.5 + 0.3);
            this.lifetime = 0;
            this.maxLifetime = config.emberMaxLifetime + Math.random() * 30;
            this.opacity = 1;
            this.color = Math.random() > 0.5 ? '#f59e0b' : '#f97316';
        }
        
        update() {
            this.lifetime++;
            this.x += this.speedX + (Math.random() - 0.5) * 0.15;
            this.y += this.speedY;
            this.speedY -= 0.008;
            this.opacity = 1 - (this.lifetime / this.maxLifetime);
            
            if (this.lifetime > this.maxLifetime || this.y < -30) {
                this.reset();
                this.lifetime = 0;
            }
        }
        
        draw() {
            ctx.globalAlpha = this.opacity * 0.5;
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }
    
    class FlameParticle {
        constructor() {
            this.reset();
        }
        
        reset() {
            const fireX = width * config.fireBaseX;
            const fireY = height * config.fireBaseY;
            const fireWidth = width * config.fireWidth;
            
            this.x = fireX + (Math.random() - 0.5) * fireWidth * 0.6;
            this.y = fireY - Math.random() * 3;
            this.size = Math.random() * 10 + 5;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = -(Math.random() * 1.2 + 0.3);
            this.lifetime = 0;
            this.maxLifetime = Math.random() * 25 + 15;
            this.opacity = 1;
            this.wobbleSpeed = Math.random() * 0.015 + 0.005;
        }
        
        update() {
            this.lifetime++;
            this.x += this.speedX + Math.sin(this.lifetime * this.wobbleSpeed) * 0.4;
            this.y += this.speedY;
            this.size *= 0.97;
            this.opacity = 1 - (this.lifetime / this.maxLifetime);
            
            if (this.lifetime > this.maxLifetime || this.size < 0.5) {
                this.reset();
                this.lifetime = 0;
            }
        }
        
        draw() {
            const gradient = ctx.createRadialGradient(
                this.x - this.size * 0.2, this.y - this.size * 0.2, 0,
                this.x, this.y, this.size
            );
            gradient.addColorStop(0, `rgba(255, 230, 180, ${this.opacity * 0.4})`);
            gradient.addColorStop(0.3, `rgba(255, 200, 130, ${this.opacity * 0.35})`);
            gradient.addColorStop(0.6, `rgba(200, 150, 90, ${this.opacity * 0.25})`);
            gradient.addColorStop(1, `rgba(100, 70, 40, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(200, 150, 80, ${this.opacity * 0.15})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
    
    function drawFireGlow() {
        const fireX = width * config.fireBaseX;
        const fireY = height * config.fireBaseY;
        const fireWidth = width * config.fireWidth;
        
        const glow = ctx.createRadialGradient(
            fireX, fireY, 0,
            fireX, fireY, fireWidth * 0.8
        );
        const brightness = 0.1 + Math.sin(time * 0.02) * 0.03;
        glow.addColorStop(0, `rgba(245, 158, 11, ${brightness * 0.6})`);
        glow.addColorStop(0.5, `rgba(200, 150, 80, ${brightness * 0.2})`);
        glow.addColorStop(1, 'rgba(200, 150, 80, 0)');
        
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(fireX, fireY, fireWidth * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function drawCampfire() {
        const fireX = width * config.fireBaseX;
        const fireY = height * config.fireBaseY;
        const fireWidth = width * config.fireWidth;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(200, 150, 80, 0.15)';
        
        ctx.fillStyle = '#1f1818';
        ctx.beginPath();
        ctx.ellipse(fireX - fireWidth * 0.3, fireY + 6, fireWidth * 0.25, 4, 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#151212';
        ctx.beginPath();
        ctx.ellipse(fireX - fireWidth * 0.3, fireY + 4, fireWidth * 0.22, 3, 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1f1818';
        ctx.beginPath();
        ctx.ellipse(fireX + fireWidth * 0.3, fireY + 6, fireWidth * 0.25, 4, -0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#151212';
        ctx.beginPath();
        ctx.ellipse(fireX + fireWidth * 0.3, fireY + 4, fireWidth * 0.22, 3, -0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1f1818';
        ctx.beginPath();
        ctx.ellipse(fireX + 1, fireY - 1, 4, fireWidth * 0.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    function drawTreeStump() {
        const fireX = width * config.fireBaseX;
        const fireY = height * config.fireBaseY;
        const stumpX = fireX - width * 0.10;
        const stumpY = fireY + 6;
        const stumpWidth = width * 0.05;
        const stumpHeight = height * 0.07;
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        
        const baseColor = '#1a1d27';
        const darkColor = '#11131a';
        const midColor = '#1f222d';
        
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(stumpX - stumpWidth * 0.6, stumpY + stumpHeight * 0.3);
        ctx.quadraticCurveTo(stumpX - stumpWidth * 0.7, stumpY, stumpX - stumpWidth * 0.5, stumpY - stumpHeight * 0.2);
        ctx.quadraticCurveTo(stumpX - stumpWidth * 0.3, stumpY - stumpHeight * 0.6, stumpX, stumpY - stumpHeight * 0.6);
        ctx.quadraticCurveTo(stumpX + stumpWidth * 0.3, stumpY - stumpHeight * 0.6, stumpX + stumpWidth * 0.5, stumpY - stumpHeight * 0.2);
        ctx.quadraticCurveTo(stumpX + stumpWidth * 0.7, stumpY, stumpX + stumpWidth * 0.6, stumpY + stumpHeight * 0.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.moveTo(stumpX - stumpWidth * 0.4, stumpY + stumpHeight * 0.25);
        ctx.quadraticCurveTo(stumpX - stumpWidth * 0.5, stumpY, stumpX - stumpWidth * 0.35, stumpY - stumpHeight * 0.15);
        ctx.quadraticCurveTo(stumpX - stumpWidth * 0.15, stumpY - stumpHeight * 0.5, stumpX, stumpY - stumpHeight * 0.5);
        ctx.quadraticCurveTo(stumpX + stumpWidth * 0.15, stumpY - stumpHeight * 0.5, stumpX + stumpWidth * 0.35, stumpY - stumpHeight * 0.15);
        ctx.quadraticCurveTo(stumpX + stumpWidth * 0.5, stumpY, stumpX + stumpWidth * 0.4, stumpY + stumpHeight * 0.25);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = midColor;
        ctx.beginPath();
        ctx.ellipse(stumpX, stumpY - stumpHeight * 0.4, stumpWidth * 0.6, stumpHeight * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(42,45,58,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(stumpX, stumpY - stumpHeight * 0.4, stumpWidth * 0.45, stumpHeight * 0.15, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(42,45,58,0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(stumpX, stumpY - stumpHeight * 0.4, stumpWidth * 0.3, stumpHeight * 0.1, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(20,22,30,0.5)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
            const xOff = (Math.random() - 0.5) * stumpWidth * 0.4;
            const startY = stumpY - stumpHeight * 0.2 + (Math.random() - 0.5) * stumpHeight * 0.2;
            ctx.beginPath();
            ctx.moveTo(stumpX + xOff, startY);
            ctx.lineTo(stumpX + xOff + (Math.random() - 0.5) * 3, startY + stumpHeight * 0.4);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(108,140,255,0.03)';
        ctx.beginPath();
        ctx.arc(stumpX + stumpWidth * 0.1, stumpY - stumpHeight * 0.3, stumpWidth * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    function drawTrees() {
        const treeConfigs = [
            { x: 0.72, height: 0.28, width: 0.05 },
            { x: 0.80, height: 0.38, width: 0.07 },
            { x: 0.90, height: 0.48, width: 0.06 },
            { x: 0.96, height: 0.32, width: 0.05 },
        ];
        
        treeConfigs.forEach(tree => {
            const x = width * tree.x;
            const baseY = height * 0.88;
            const treeHeight = height * tree.height;
            const treeWidth = width * tree.width;
            
            ctx.fillStyle = '#1a1d27';
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            
            ctx.beginPath();
            ctx.moveTo(x, baseY);
            ctx.lineTo(x - treeWidth * 1.2, baseY - treeHeight * 0.3);
            ctx.lineTo(x - treeWidth * 0.6, baseY - treeHeight * 0.5);
            ctx.lineTo(x - treeWidth * 0.9, baseY - treeHeight * 0.7);
            ctx.lineTo(x - treeWidth * 0.4, baseY - treeHeight * 0.85);
            ctx.lineTo(x, baseY - treeHeight);
            ctx.lineTo(x + treeWidth * 0.4, baseY - treeHeight * 0.85);
            ctx.lineTo(x + treeWidth * 0.9, baseY - treeHeight * 0.7);
            ctx.lineTo(x + treeWidth * 0.6, baseY - treeHeight * 0.5);
            ctx.lineTo(x + treeWidth * 1.2, baseY - treeHeight * 0.3);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#11131a';
            ctx.fillRect(x - treeWidth * 0.08, baseY - treeHeight * 0.05, treeWidth * 0.16, treeHeight * 0.06);
            
            ctx.fillStyle = 'rgba(108,140,255,0.04)';
            ctx.beginPath();
            ctx.moveTo(x, baseY - treeHeight * 0.35);
            ctx.lineTo(x - treeWidth * 0.5, baseY - treeHeight * 0.55);
            ctx.lineTo(x + treeWidth * 0.5, baseY - treeHeight * 0.55);
            ctx.closePath();
            ctx.fill();
        });
        
        ctx.shadowBlur = 0;
    }
    
    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0a0f');
        gradient.addColorStop(0.4, '#0f1117');
        gradient.addColorStop(0.7, '#141118');
        gradient.addColorStop(1, '#0b0a0e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    function drawGround() {
        const fireX = width * config.fireBaseX;
        const fireY = height * config.fireBaseY;
        
        const gradient = ctx.createRadialGradient(
            fireX, fireY + 20, 0,
            fireX, fireY + 20, width * 0.3
        );
        gradient.addColorStop(0, 'rgba(26, 29, 39, 0.25)');
        gradient.addColorStop(1, 'rgba(15, 17, 23, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, fireY + 10, width, height - fireY - 10);
    }
    
    function drawCampfireLighting() {
        const fireX = width * config.fireBaseX;
        const fireY = height * config.fireBaseY;

        //
        // SHADOW MASK
        //
        const shadow = ctx.createRadialGradient(
            fireX,
            fireY,
            width * 0.05,
            fireX,
            fireY,
            width * 0.70
        );

        shadow.addColorStop(0.00, 'rgba(0,0,0,0)');
        shadow.addColorStop(0.20, 'rgba(0,0,0,0.05)');
        shadow.addColorStop(0.40, 'rgba(0,0,0,0.20)');
        shadow.addColorStop(0.65, 'rgba(0,0,0,0.50)');
        shadow.addColorStop(1.00, 'rgba(0,0,0,0.78)');

        ctx.fillStyle = shadow;
        ctx.fillRect(0, 0, width, height);

        //
        // WARM LIGHT
        //
        const light = ctx.createRadialGradient(
            fireX,
            fireY,
            0,
            fireX,
            fireY,
            width * 0.22
        );

        const flicker = 0.85 + Math.sin(time * 8) * 0.05;

        light.addColorStop(
            0,
            `rgba(255,190,90,${0.08 * flicker})`
        );

        light.addColorStop(
            0.5,
            `rgba(255,140,40,${0.04 * flicker})`
        );

        light.addColorStop(
            1,
            'rgba(255,120,20,0)'
        );

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    function draw(timestamp) {
        time = timestamp / 1000;
        
        ctx.clearRect(0, 0, width, height);
        
        drawBackground();
        drawGround();
        drawTrees();
        drawTreeStump();
        drawCampfireLighting();
        drawCampfire();
        drawFireGlow();
        
        flameParticles.forEach(p => {
            p.update();
            p.draw();
        });
        
        emberParticles.forEach(p => {
            p.update();
            p.draw();
        });
        
        smokeParticles.forEach(p => {
            p.update();
            p.draw();
        });
        
        animationId = requestAnimationFrame(draw);
    }
    
    function initParticles() {
        smokeParticles = [];
        emberParticles = [];
        flameParticles = [];
        
        for (let i = 0; i < config.smokeCount; i++) {
            const p = new SmokeParticle();
            p.lifetime = Math.random() * p.maxLifetime;
            smokeParticles.push(p);
        }
        
        for (let i = 0; i < config.emberCount; i++) {
            const p = new EmberParticle();
            p.lifetime = Math.random() * p.maxLifetime;
            emberParticles.push(p);
        }
        
        for (let i = 0; i < config.flameCount; i++) {
            const p = new FlameParticle();
            p.lifetime = Math.random() * p.maxLifetime;
            flameParticles.push(p);
        }
    }
    
    function start() {
        resize();
        initParticles();
        if (animationId) cancelAnimationFrame(animationId);
        draw(0);
    }
    
    function destroy() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        ctx.clearRect(0, 0, width, height);
        smokeParticles = [];
        emberParticles = [];
        flameParticles = [];
    }
    
    const resizeHandler = () => {
        resize();
        initParticles();
    };
    window.addEventListener('resize', resizeHandler);
    
    start();
    
    return {
        destroy: function() {
            destroy();
            window.removeEventListener('resize', resizeHandler);
        },
        resize: function() {
            resize();
            initParticles();
        }
    };
};
