import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/store/appStore';

interface Particle {
  id: number;
  x: number;
  y: number;
}

export function AnimatedXP() {
  const xp = useAppStore((state) => state.xp);
  const [displayXP, setDisplayXP] = useState(xp);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousXPRef = useRef(xp);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (xp > previousXPRef.current) {
      const gained = xp - previousXPRef.current;

      // Create flying particles
      const newParticles: Particle[] = [];
      const particleCount = Math.min(Math.floor(gained / 2), 10); // Max 10 particles

      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: Date.now() + i,
          x: Math.random() * 100 - 50, // Random position around center
          y: Math.random() * 100 + 50, // Start from bottom
        });
      }

      setParticles(newParticles);
      setIsAnimating(true);

      // Animate XP counter
      setTimeout(() => {
        const duration = 1000;
        const startValue = displayXP;
        const endValue = xp;
        const startTime = Date.now();

        const updateCounter = () => {
          const now = Date.now();
          const progress = Math.min((now - startTime) / duration, 1);
          const easeOutQuad = 1 - (1 - progress) * (1 - progress);
          const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuad);

          setDisplayXP(currentValue);

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          }
        };

        requestAnimationFrame(updateCounter);
      }, 600); // Delay to let particles fly first

      // Clean up particles
      setTimeout(() => {
        setParticles([]);
        setIsAnimating(false);
      }, 1500);
    }

    previousXPRef.current = xp;
  }, [xp, displayXP]);

  return (
    <div ref={containerRef} className="relative mt-3">
      {/* Flying particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute pointer-events-none z-50"
          style={{
            left: `calc(50% + ${particle.x}px)`,
            top: `${particle.y}px`,
            animation: 'flyToXP 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          }}
        >
          <div className="flex items-center gap-1 text-[#97E35C] font-bold text-sm animate-pulse">
            <span>+{Math.floor(10 / particles.length)}</span>
            <img
              src="/ps-logo.png"
              alt="XP"
              className="h-3 w-3 object-contain"
            />
          </div>
        </div>
      ))}

      {/* XP Display */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary relative ${
          isAnimating ? 'animate-bounce' : ''
        }`}
      >
        {displayXP.toLocaleString()}
        <img
          src="/ps-logo.png"
          alt="XP"
          className="h-4 w-4 object-contain"
        />

        {/* Celebration sparkles when gaining XP */}
        {isAnimating && (
          <>
            <span className="absolute -top-1 -right-1 text-[#97E35C] animate-ping">✨</span>
            <span className="absolute -top-2 left-1/4 text-[#97E35C] animate-pulse">⭐</span>
            <span className="absolute -bottom-1 -left-1 text-[#97E35C] animate-ping">💫</span>
          </>
        )}
      </span>

      <style>{`
        @keyframes flyToXP {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) translateX(0) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}
