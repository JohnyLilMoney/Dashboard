(function(){
  function initAnimation(shadowRoot){
    const canvas = shadowRoot.querySelector('#night-canvas');
    if(!canvas){
      console.warn('Canvas #night-canvas not found in shadowRoot');
      return {destroy:function(){}, resize:function(){}};
    }
    const ctx = canvas.getContext('2d');
    let W, H, stars=[], clouds=[], animationId=null, time=0;
    let moonX=0, moonY=0;

    const MOON_X_RATIO = 0.75;
    const MOON_Y_RATIO = 0.35;
    const MOON_RADIUS = 44;
    const MOON_GLOW_RADIUS = 320;
    const STAR_COUNT = 150;
    const CLOUD_COUNT = 500;
    const CLOUD_DRIFT_X = 0.25;
    const CLOUD_DRIFT_Y = 0.06;

    let cloudCanvas, cloudCtx;

    const MOON_CLOUD_CLEAR_RADIUS = 50;
    const MOON_CLOUD_FADE_RADIUS  = 340;

    const palette = [
      {r:15, g:17, b:23},
      {r:26, g:29, b:39},
      {r:42, g:45, b:58},
      {r:20, g:22, b:30},
      {r:30, g:33, b:46},
      {r:35, g:37, b:50},
      {r:18, g:20, b:28},
      {r:40, g:42, b:55}
    ];

    function resize(){
        const rect = shadowRoot.host.getBoundingClientRect();
        W = rect.width;
        H = rect.height;
        canvas.width = W;
        canvas.height = H;
        moonX = W * MOON_X_RATIO;
        moonY = H * MOON_Y_RATIO;

        if(!cloudCanvas){
            cloudCanvas = document.createElement('canvas');
            cloudCtx = cloudCanvas.getContext('2d');
        }
        cloudCanvas.width = W;
        cloudCanvas.height = H;
    }

    function generateStars(){
      stars = [];
      for(let i=0;i<STAR_COUNT;i++){
        stars.push({
          x: Math.random()*W,
          y: Math.random()*H,
          radius: 0.4 + Math.random()*1.8,
          speed: 0.0015 + Math.random()*0.0075,
          phase: Math.random()*Math.PI*2,
          baseBright: 0.35 + Math.random()*0.65
        });
      }
    }

    function generateClouds(){
      clouds = [];
      margin = 300;
      const numClusters = 10 + Math.floor(Math.random()*6);
      const clusters = [];
      for(let i=0;i<numClusters;i++){
        clusters.push({
          cx: Math.random() * (W + 2 * margin) - margin,
          cy: Math.random() * (H + 2 * margin) - margin,
          spread: 150 + Math.random()*300
        });
      }
      for(let i=0;i<CLOUD_COUNT;i++){
        const cluster = clusters[Math.floor(Math.random()*clusters.length)];
        const angle = Math.random()*Math.PI*2;
        const dist = Math.random()*cluster.spread;
        const x = cluster.cx + Math.cos(angle)*dist;
        const y = cluster.cy + Math.sin(angle)*dist;
        const size = 120 + Math.random()*300;
        const numBlobs = 6 + Math.floor(Math.random()*8);
        const blobs = [];
        const baseR = size * (0.15 + Math.random()*0.20);
        for(let b=0;b<numBlobs;b++){
          const a = Math.random()*Math.PI*2;
          const d = Math.random()*size*0.8;
          const r = baseR * (0.5 + Math.random()*0.6);
          blobs.push({
            dx: Math.cos(a)*d,
            dy: Math.sin(a)*d,
            radius: Math.max(6, r)
          });
        }
        const pal = palette[Math.floor(Math.random()*palette.length)];
        const opacity = 0.04 + Math.random()*0.12;
        clouds.push({
          x: x, y: y,
          blobs: blobs,
          color: pal,
          opacity: opacity,
          driftX: CLOUD_DRIFT_X + (Math.random()-0.5)*0.08,
          driftY: CLOUD_DRIFT_Y + (Math.random()-0.5)*0.04,
        });
      }
    }

    function draw(timestamp){
      time = timestamp * 0.001;
      ctx.clearRect(0, 0, W, H);

      stars.forEach(star => {
        const bright = star.baseBright * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
        const alpha = 0.15 + 0.85 * bright;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
        if(star.radius > 1.6){
          ctx.shadowBlur = 14;
          ctx.shadowColor = `rgba(210,225,255,${alpha*0.25})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      const grad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, MOON_GLOW_RADIUS);
      grad.addColorStop(0, 'rgba(255,248,232,0.50)');
      grad.addColorStop(0.08, 'rgba(255,245,225,0.40)');
      grad.addColorStop(0.25, 'rgba(255,240,215,0.20)');
      grad.addColorStop(0.5, 'rgba(255,235,210,0.08)');
      grad.addColorStop(1, 'rgba(255,230,200,0)');
      ctx.beginPath();
      ctx.arc(moonX, moonY, MOON_GLOW_RADIUS, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.fill();

      const grad2 = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, MOON_GLOW_RADIUS*1.8);
      grad2.addColorStop(0, 'rgba(200,215,255,0.08)');
      grad2.addColorStop(0.5, 'rgba(180,200,255,0.04)');
      grad2.addColorStop(1, 'rgba(160,185,255,0)');
      ctx.beginPath();
      ctx.arc(moonX, moonY, MOON_GLOW_RADIUS*1.8, 0, Math.PI*2);
      ctx.fillStyle = grad2;
      ctx.fill();

      const moonGrad = ctx.createRadialGradient(
        moonX - MOON_RADIUS*0.15, moonY - MOON_RADIUS*0.15, MOON_RADIUS*0.1,
        moonX, moonY, MOON_RADIUS
      );
      moonGrad.addColorStop(0, '#fffcf5');
      moonGrad.addColorStop(0.7, '#f5efe6');
      moonGrad.addColorStop(1, '#dcd5cb');
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(255,240,215,0.3)';
      ctx.beginPath();
      ctx.arc(moonX, moonY, MOON_RADIUS, 0, Math.PI*2);
      ctx.fillStyle = moonGrad;
      ctx.fill();
      ctx.shadowBlur = 0;

        clouds.forEach(cloud => {
        cloud.blobs.forEach(blob => {
            const bx = cloud.x + blob.dx;
            const by = cloud.y + blob.dy;

            const dx = bx - moonX;
            const dy = by - moonY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            let t = (dist - MOON_CLOUD_CLEAR_RADIUS) / (MOON_CLOUD_FADE_RADIUS - MOON_CLOUD_CLEAR_RADIUS);
            t = Math.min(1, Math.max(0, t));
            const fade = t * t * (3 - 2 * t);

            const alpha = cloud.opacity * fade;
            if (alpha <= 0.002) return;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(bx, by, blob.radius, 0, Math.PI*2);
            ctx.fillStyle = `rgb(${cloud.color.r},${cloud.color.g},${cloud.color.b})`;
            ctx.fill();
            });
        });
        ctx.globalAlpha = 1.0;
    }

    function tick(timestamp){
    clouds.forEach(c => {
        c.x += c.driftX;
        c.y += c.driftY;

        const margin = 300;

        if (c.x > W + margin) c.x = -margin - Math.random() * 200;
        if (c.x < -margin - 200) c.x = W + margin;

        if (c.y > H + margin) c.y = -margin - Math.random() * 200;
        if (c.y < -margin - 200) c.y = H + margin;
    });
    draw(timestamp);
    animationId = requestAnimationFrame(tick);
    }

    function start(){
      resize();
      generateStars();
      generateClouds();
      if(animationId) cancelAnimationFrame(animationId);
      tick(0);
    }

    function destroy(){
      if(animationId){
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      ctx.clearRect(0, 0, W, H);
      stars = [];
      clouds = [];
    }

    const resizeHandler = function(){
      resize();
      generateStars();
      generateClouds();
    };
    window.addEventListener('resize', resizeHandler);

    start();

    return {
      destroy: function(){
        destroy();
        window.removeEventListener('resize', resizeHandler);
      },
      resize: function(){
        resize();
        generateStars();
        generateClouds();
      }
    };
  }

  if(typeof window !== 'undefined'){
    window.initAnimation = initAnimation;
  }
})();