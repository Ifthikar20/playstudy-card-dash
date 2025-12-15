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

interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  hasRing: boolean;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
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
    const planets: Planet[] = [];
    const nebulae: Nebula[] = [];
    const maxShootingStars = 8;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStaticElements();
    };

    const initStaticElements = () => {
      // Clear and recreate static stars
      staticStars.length = 0;
      for (let i = 0; i < 200; i++) {
        staticStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }

      // Create planets with teal/cyan tones
      planets.length = 0;
      planets.push(
        {
          x: canvas.width * 0.85,
          y: canvas.height * 0.2,
          radius: 25,
          color: '#14b8a6',
          glowColor: 'rgba(20, 184, 166, 0.3)',
          hasRing: true,
        },
        {
          x: canvas.width * 0.1,
          y: canvas.height * 0.7,
          radius: 15,
          color: '#0ea5e9',
          glowColor: 'rgba(14, 165, 233, 0.2)',
          hasRing: false,
        },
        {
          x: canvas.width * 0.7,
          y: canvas.height * 0.8,
          radius: 8,
          color: '#22d3ee',
          glowColor: 'rgba(34, 211, 238, 0.2)',
          hasRing: false,
        }
      );

      // Create nebulae/clouds with teal/green/blue tones
      nebulae.length = 0;
      nebulae.push(
        {
          x: canvas.width * 0.2,
          y: canvas.height * 0.3,
          radius: 150,
          color: 'rgba(20, 184, 166, 0.06)',
          opacity: 0.5,
        },
        {
          x: canvas.width * 0.8,
          y: canvas.height * 0.6,
          radius: 200,
          color: 'rgba(14, 165, 233, 0.05)',
          opacity: 0.4,
        },
        {
          x: canvas.width * 0.5,
          y: canvas.height * 0.15,
          radius: 120,
          color: 'rgba(34, 211, 238, 0.04)',
          opacity: 0.3,
        }
      );
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

    const drawNebulae = () => {
      nebulae.forEach((nebula) => {
        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.radius
        );
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(0.5, nebula.color.replace(/[\d.]+\)$/, '0.03)'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
    };

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

    const drawPlanets = () => {
      planets.forEach((planet) => {
        // Draw glow
        const glowGradient = ctx.createRadialGradient(
          planet.x, planet.y, planet.radius * 0.5,
          planet.x, planet.y, planet.radius * 3
        );
        glowGradient.addColorStop(0, planet.glowColor);
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Draw ring if applicable
        if (planet.hasRing) {
          ctx.save();
          ctx.translate(planet.x, planet.y);
          ctx.rotate(-0.3);
          ctx.scale(1, 0.3);
          ctx.beginPath();
          ctx.arc(0, 0, planet.radius * 1.8, 0, Math.PI * 2);
          ctx.strokeStyle = `${planet.color}66`;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }

        // Draw planet
        const planetGradient = ctx.createRadialGradient(
          planet.x - planet.radius * 0.3, planet.y - planet.radius * 0.3, 0,
          planet.x, planet.y, planet.radius
        );
        planetGradient.addColorStop(0, planet.color);
        planetGradient.addColorStop(1, `${planet.color}88`);
        
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
        ctx.fillStyle = planetGradient;
        ctx.fill();
      });
    };

    const drawShootingStars = () => {
      shootingStars.forEach((star, index) => {
        // Softer, more ethereal shooting star with teal/cyan tones
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background elements
      drawNebulae();
      drawStaticStars(time);
      drawPlanets();

      // Add new shooting stars occasionally
      if (shootingStars.length < maxShootingStars && Math.random() < 0.015) {
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
      style={{ zIndex: 0 }}
    />
  );
}
