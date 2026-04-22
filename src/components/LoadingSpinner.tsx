interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = "Loading...", size = 'md' }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return (
    <div className="text-center flex flex-col items-center justify-center gap-4">
      {/* Airbnb-style spinner */}
      <div className={`${sizeMap[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

// Alternative design - Minimal dots loader
export function LoadingBrain({ message = "Processing..." }: { message?: string }) {
  return (
    <div className="text-center flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {message}
      </p>

      {/* Progress bar */}
      <div className="w-48 airbnb-progress">
        <div className="airbnb-progress-bar w-full" style={{ animation: 'shimmer-slide 1.5s ease-in-out infinite' }} />
      </div>

      <style>{`
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
