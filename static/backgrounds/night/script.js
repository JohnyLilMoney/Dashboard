window.initAnimation = function(shadowRoot) {
    const canvas = shadowRoot.querySelector('#stars-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let stars = [];
    let animationId = null;

    function resize() {
        const rect = shadowRoot.host.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
    }

    function createStars(count = 120) {
        stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.5 + 0.5,
                speed: Math.random() * 0.005 + 0.002,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    function draw(time) {
        ctx.clearRect(0, 0, width, height);

        stars.forEach(star => {
            const brightness = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
            const alpha = brightness * 0.9 + 0.1;

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();

            if (star.radius > 1.2) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = `rgba(200, 220, 255, ${alpha * 0.3})`;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        animationId = requestAnimationFrame(draw);
    }

    function start() {
        resize();
        createStars(150);
        if (animationId) cancelAnimationFrame(animationId);
        draw(0);
    }

    function destroy() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        ctx.clearRect(0, 0, width, height);
        stars = [];
    }

    const resizeHandler = () => {
        resize();
        createStars(150);
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
            createStars(150);
        }
    };
};
