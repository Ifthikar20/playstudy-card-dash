interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = "Loading...", size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-16 w-16',
    lg: 'h-24 w-24'
  };

  return (
    <div className="text-center">
      {/* Animated container with glow effect */}
      <div className="relative inline-block">
        {/* Pulsing glow background */}
        <div className="absolute inset-0 rounded-full bg-[#97E35C]/20 blur-xl animate-pulse"></div>

        {/* Main spinner */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className={`${sizeClasses[size]} rounded-full border-4 border-transparent border-t-[#97E35C] border-r-[#97E35C] animate-spin`}></div>

          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-[#97E35C] animate-ping"></div>
            <div className="absolute h-2 w-2 rounded-full bg-[#97E35C]"></div>
          </div>
        </div>
      </div>

      {/* Loading text with gradient */}
      <p className="mt-6 text-lg font-medium bg-gradient-to-r from-[#97E35C] to-[#7BC850] bg-clip-text text-transparent animate-pulse">
        {message}
      </p>

      {/* Animated dots */}
      <div className="flex justify-center gap-1 mt-3">
        <div className="h-2 w-2 rounded-full bg-[#97E35C] animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="h-2 w-2 rounded-full bg-[#97E35C] animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="h-2 w-2 rounded-full bg-[#97E35C] animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
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
