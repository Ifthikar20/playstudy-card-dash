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
      // Clear and recreate static stars - more stars for a deeper space feel
      staticStars.length = 0;
      for (let i = 0; i < 300; i++) {
        staticStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.2 + 0.3,
          opacity: Math.random() * 0.6 + 0.2,
          twinkleSpeed: Math.random() * 0.015 + 0.005,
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
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const currentOpacity = star.opacity * twinkle;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.fill();
      });
    };

    const drawMoon = () => {
      const moonX = canvas.width * 0.85;
      const moonY = canvas.height * 0.15;
      const moonRadius = Math.min(canvas.width, canvas.height) * 0.055;

      // Outer glow
      const outerGlow = ctx.createRadialGradient(
        moonX, moonY, moonRadius,
        moonX, moonY, moonRadius * 4
      );
      outerGlow.addColorStop(0, 'rgba(200, 210, 230, 0.12)');
      outerGlow.addColorStop(0.5, 'rgba(180, 200, 220, 0.04)');
      outerGlow.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 4, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // Inner glow
      const innerGlow = ctx.createRadialGradient(
        moonX, moonY, moonRadius * 0.8,
        moonX, moonY, moonRadius * 1.5
      );
      innerGlow.addColorStop(0, 'rgba(240, 245, 255, 0.25)');
      innerGlow.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = innerGlow;
      ctx.fill();

      // Moon body with gradient
      const moonGradient = ctx.createRadialGradient(
        moonX - moonRadius * 0.35, moonY - moonRadius * 0.35, 0,
        moonX, moonY, moonRadius
      );
      moonGradient.addColorStop(0, '#f8f9fc');
      moonGradient.addColorStop(0.4, '#e8eaef');
      moonGradient.addColorStop(0.8, '#d0d4dc');
      moonGradient.addColorStop(1, '#b8bcc8');

      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fillStyle = moonGradient;
      ctx.fill();

      // Moon craters
      const craters = [
        { x: 0.25, y: -0.15, r: 0.18, opacity: 0.25 },
        { x: -0.3, y: 0.25, r: 0.14, opacity: 0.2 },
        { x: 0.05, y: 0.35, r: 0.12, opacity: 0.22 },
        { x: -0.15, y: -0.3, r: 0.1, opacity: 0.18 },
        { x: 0.35, y: 0.15, r: 0.08, opacity: 0.15 },
        { x: -0.4, y: -0.1, r: 0.07, opacity: 0.12 },
      ];

      craters.forEach(crater => {
        const craterX = moonX + crater.x * moonRadius;
        const craterY = moonY + crater.y * moonRadius;
        const craterRadius = crater.r * moonRadius;

        const craterGradient = ctx.createRadialGradient(
          craterX - craterRadius * 0.3, craterY - craterRadius * 0.3, 0,
          craterX, craterY, craterRadius
        );
        craterGradient.addColorStop(0, `rgba(160, 165, 175, ${crater.opacity * 0.5})`);
        craterGradient.addColorStop(1, `rgba(140, 145, 155, ${crater.opacity})`);

        ctx.beginPath();
        ctx.arc(craterX, craterY, craterRadius, 0, Math.PI * 2);
        ctx.fillStyle = craterGradient;
        ctx.fill();
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
      drawMoon();

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
