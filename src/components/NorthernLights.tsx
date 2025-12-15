import { useEffect, useRef } from 'react';

const NorthernLights = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let animationId: number;
    let time = 0;

    const drawNorthernLights = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw multiple aurora layers
      const layers = [
        { color: 'rgba(34, 197, 94, 0.15)', offset: 0, speed: 0.0003 },
        { color: 'rgba(59, 130, 246, 0.12)', offset: 100, speed: 0.0004 },
        { color: 'rgba(139, 92, 246, 0.1)', offset: 200, speed: 0.0002 },
        { color: 'rgba(6, 182, 212, 0.08)', offset: 50, speed: 0.00035 },
      ];

      layers.forEach((layer) => {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        for (let x = 0; x <= canvas.width; x += 5) {
          const y = canvas.height * 0.3 + 
            Math.sin(x * 0.003 + time * layer.speed * 1000 + layer.offset) * 80 +
            Math.sin(x * 0.007 + time * layer.speed * 800) * 40 +
            Math.sin(x * 0.001 + time * layer.speed * 500) * 60;
          
          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, layer.color);
        gradient.addColorStop(0.5, layer.color.replace(/[\d.]+\)$/, '0.05)'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Add subtle vertical rays
      for (let i = 0; i < 8; i++) {
        const x = (canvas.width / 8) * i + Math.sin(time * 0.0002 + i) * 50;
        const height = canvas.height * 0.5 + Math.sin(time * 0.0003 + i * 0.5) * 100;
        
        const rayGradient = ctx.createLinearGradient(x, 0, x, height);
        rayGradient.addColorStop(0, 'rgba(34, 197, 94, 0.03)');
        rayGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.02)');
        rayGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = rayGradient;
        ctx.fillRect(x - 30, 0, 60, height);
      }

      // Draw some stars
      for (let i = 0; i < 100; i++) {
        const x = (Math.sin(i * 567.8) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 234.5) * 0.5 + 0.5) * canvas.height * 0.6;
        const size = (Math.sin(i * 123.4) * 0.5 + 0.5) * 1.5 + 0.5;
        const twinkle = Math.sin(time * 0.002 + i) * 0.3 + 0.7;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
        ctx.fill();
      }

      time++;
      animationId = requestAnimationFrame(drawNorthernLights);
    };

    drawNorthernLights();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default NorthernLights;
