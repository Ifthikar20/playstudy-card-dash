import { useEffect, useRef } from 'react';

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  angle: number;
  width: number;
}

interface StaticStar {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export default function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const shootingStars: ShootingStar[] = [];
    const staticStars: StaticStar[] = [];
    const maxShootingStars = 6;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStaticElements();
    };

    const initStaticElements = () => {
      staticStars.length = 0;
      
      // Far away stars - small and dim
      for (let i = 0; i < 200; i++) {
        staticStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 0.8 + 0.2,
          opacity: Math.random() * 0.3 + 0.1,
          twinkleSpeed: Math.random() * 0.01 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
      
      // Medium distance stars
      for (let i = 0; i < 80; i++) {
        staticStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.2 + 0.5,
          opacity: Math.random() * 0.5 + 0.3,
          twinkleSpeed: Math.random() * 0.015 + 0.005,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
      
      // Near stars - larger and brighter
      for (let i = 0; i < 25; i++) {
        staticStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.8 + 1,
          opacity: Math.random() * 0.4 + 0.5,
          twinkleSpeed: Math.random() * 0.02 + 0.008,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const createShootingStar = (): ShootingStar => ({
      x: Math.random() * canvas.width * 0.5,
      y: Math.random() * canvas.height * 0.3,
      length: Math.random() * 60 + 30,
      speed: Math.random() * 4 + 2,
      opacity: Math.random() * 0.5 + 0.3,
      angle: Math.PI / 4 + (Math.random() * 0.3 - 0.15),
      width: Math.random() * 1.5 + 0.5,
    });

    const drawStaticStars = (time: number) => {
      staticStars.forEach((star) => {
        // More pronounced twinkling effect
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        const twinkle2 = Math.sin(time * star.twinkleSpeed * 1.7 + star.twinkleOffset * 0.5);
        const combined = (twinkle + twinkle2 * 0.5) / 1.5;
        const currentOpacity = star.opacity * (0.4 + combined * 0.6);
        
        // Add occasional bright flash for some stars
        const flash = Math.sin(time * star.twinkleSpeed * 3 + star.twinkleOffset) > 0.95 ? 0.3 : 0;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, currentOpacity + flash)})`;
        ctx.fill();
        
        // Add subtle glow for brighter moments
        if (currentOpacity > 0.6 || flash > 0) {
          const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3);
          glow.addColorStop(0, `rgba(255, 255, 255, ${(currentOpacity + flash) * 0.3})`);
          glow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }
      });
    };

    const drawShootingStars = () => {
      shootingStars.forEach((star, index) => {
        const gradient = ctx.createLinearGradient(
          star.x,
          star.y,
          star.x - Math.cos(star.angle) * star.length,
          star.y - Math.sin(star.angle) * star.length
        );
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        gradient.addColorStop(0.2, `rgba(180, 240, 255, ${star.opacity * 0.6})`);
        gradient.addColorStop(0.6, `rgba(20, 184, 166, ${star.opacity * 0.3})`);
        gradient.addColorStop(1, 'rgba(20, 184, 166, 0)');

        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(
          star.x - Math.cos(star.angle) * star.length,
          star.y - Math.sin(star.angle) * star.length
        );
        ctx.strokeStyle = gradient;
        ctx.lineWidth = star.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Soft glow at head
        const headGlow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 4);
        headGlow.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        headGlow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(star.x, star.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();

        // Move the star
        star.x += Math.cos(star.angle) * star.speed;
        star.y += Math.sin(star.angle) * star.speed;

        // Fade out as it travels
        star.opacity *= 0.995;

        // Remove if off screen or faded
        if (star.x > canvas.width + 100 || star.y > canvas.height + 100 || star.opacity < 0.05) {
          shootingStars.splice(index, 1);
        }
      });
    };

    let time = 0;
    const animate = () => {
      time++;
      
      // Deep black space background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawStaticStars(time);

      // Add new shooting stars occasionally
      if (shootingStars.length < maxShootingStars && Math.random() < 0.012) {
        shootingStars.push(createShootingStar());
      }

      drawShootingStars();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0, background: '#050508' }}
    />
  );
}
