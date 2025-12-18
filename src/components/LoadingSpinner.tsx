interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = "Loading...", size = 'md' }: LoadingSpinnerProps) {
  const sizeConfig = {
    sm: { container: 150, scale: 0.6 },
    md: { container: 250, scale: 1 },
    lg: { container: 350, scale: 1.4 }
  };

  const config = sizeConfig[size];

  return (
    <div className="text-center flex flex-col items-center justify-center">
      {/* Breathing Donut Loader */}
      <div
        className="relative"
        style={{
          width: `${config.container}px`,
          height: `${config.container}px`,
          transform: `scale(${config.scale})`
        }}
      >
        {/* Outer glow layer */}
        <div
          className="absolute inset-0 rounded-full donut-glow"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(167, 139, 250, 0.15) 45%, rgba(96, 165, 250, 0.1) 55%, transparent 70%)',
            filter: 'blur(35px)',
            animation: 'glow-pulse 3s ease-in-out infinite'
          }}
        />

        {/* Second layer for depth */}
        <div
          className="absolute inset-0 rounded-full donut-layer-2"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 38%, rgba(196, 181, 253, 0.35) 43%, rgba(167, 139, 250, 0.5) 50%, rgba(96, 165, 250, 0.3) 58%, transparent 68%)',
            filter: 'blur(20px)',
            animation: 'breathe-reverse 4s ease-in-out infinite, rotate-reverse 12s linear infinite'
          }}
        />

        {/* Main donut ring */}
        <div
          className="absolute inset-0 rounded-full donut-ring"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 35%, rgba(167, 139, 250, 0.25) 40%, rgba(139, 92, 246, 0.4) 50%, rgba(96, 165, 250, 0.35) 60%, rgba(147, 197, 253, 0.2) 70%, transparent 75%)',
            filter: 'blur(25px)',
            animation: 'breathe 4s ease-in-out infinite, rotate 10s linear infinite'
          }}
        />

        {/* Inner shimmer */}
        <div
          className="absolute inset-0 rounded-full donut-shimmer"
          style={{
            background: 'radial-gradient(circle at 60% 40%, transparent 35%, rgba(220, 208, 255, 0.4) 42%, transparent 50%)',
            filter: 'blur(15px)',
            animation: 'shimmer 5s ease-in-out infinite'
          }}
        />
      </div>

      {/* Loading text */}
      <p className="mt-8 text-lg font-medium text-foreground/80">
        {message}
      </p>

      {/* Animated dots */}
      <div className="flex justify-center gap-1 mt-3">
        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 0.8;
          }
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes breathe-reverse {
          0%, 100% {
            transform: scale(1.2) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: scale(0.85) rotate(-180deg);
            opacity: 0.7;
          }
        }

        @keyframes rotate-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes glow-pulse {
          0%, 100% {
            transform: scale(0.9);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.6;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            transform: rotate(0deg) scale(0.95);
            opacity: 0.3;
          }
          25% {
            transform: rotate(90deg) scale(1.15);
            opacity: 0.6;
          }
          50% {
            transform: rotate(180deg) scale(0.95);
            opacity: 0.3;
          }
          75% {
            transform: rotate(270deg) scale(1.15);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

// Alternative design - Brain icon with pulse
export function LoadingBrain({ message = "Processing..." }: { message?: string }) {
  return (
    <div className="text-center">
      {/* Animated brain graphic */}
      <div className="relative inline-block">
        {/* Outer glow rings */}
        <div className="absolute inset-0 -m-8">
          <div className="h-32 w-32 rounded-full border-2 border-[#97E35C]/30 animate-ping"></div>
        </div>
        <div className="absolute inset-0 -m-6">
          <div className="h-28 w-28 rounded-full border-2 border-[#97E35C]/50 animate-pulse"></div>
        </div>

        {/* Brain SVG */}
        <div className="relative h-16 w-16 animate-pulse">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#97E35C]">
            <path d="M9.5 2C8.96957 2 8.44086 2.10346 7.94437 2.30448C7.44788 2.5055 6.99239 2.80014 6.60218 3.17157C6.21197 3.543 5.89504 3.98396 5.66441 4.47487C5.43378 4.96578 5.29344 5.49661 5.25 6.04" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M14.5 2C15.0304 2 15.5591 2.10346 16.0556 2.30448C16.5521 2.5055 17.0076 2.80014 17.3978 3.17157C17.788 3.543 18.105 3.98396 18.3356 4.47487C18.5662 4.96578 18.7066 5.49661 18.75 6.04" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 9C9 8.20435 9.31607 7.44129 9.87868 6.87868C10.4413 6.31607 11.2044 6 12 6C12.7956 6 13.5587 6.31607 14.1213 6.87868C14.6839 7.44129 15 8.20435 15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 14V18M12 18L9 16M12 18L15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 20H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <p className="mt-8 text-lg font-medium text-[#97E35C] animate-pulse">
        {message}
      </p>

      {/* Progress bar */}
      <div className="mt-4 w-48 h-1 bg-gray-700 rounded-full overflow-hidden mx-auto">
        <div className="h-full bg-gradient-to-r from-[#97E35C] to-[#7BC850] animate-[shimmer_1.5s_ease-in-out_infinite]"
             style={{ width: '100%', animation: 'shimmer 1.5s ease-in-out infinite' }}>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
