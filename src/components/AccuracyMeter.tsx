
interface AccuracyMeterProps {
  accuracy: number; // 0-100
}

export function AccuracyMeter({ accuracy }: AccuracyMeterProps) {
  const rotation = (accuracy / 100) * 180 - 90; // -90 to 90 degrees
  const getColor = (acc: number) => {
    if (acc >= 80) return "#10B981"; // green
    if (acc >= 60) return "#F59E0B"; // yellow
    if (acc >= 40) return "#F97316"; // orange
    return "#EF4444"; // red
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        Accuracy Meter
      </h3>
      
      <div className="relative w-48 h-24 mx-auto">
        {/* Speedometer background */}
        <div className="absolute inset-0">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 20 80 A 80 80 0 0 1 180 80"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
              strokeLinecap="round"
            />
            
            {/* Colored segments */}
            <path
              d="M 20 80 A 80 80 0 0 0 60 25"
              fill="none"
              stroke="#EF4444"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 60 25 A 80 80 0 0 0 100 20"
              fill="none"
              stroke="#F97316"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 100 20 A 80 80 0 0 0 140 25"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 140 25 A 80 80 0 0 0 180 80"
              fill="none"
              stroke="#10B981"
              strokeWidth="8"
              strokeLinecap="round"
            />
            
            {/* Center circle */}
            <circle cx="100" cy="80" r="8" fill="#374151" />
            
            {/* Needle */}
            <line
              x1="100"
              y1="80"
              x2="100"
              y2="30"
              stroke={getColor(accuracy)}
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                transformOrigin: "100px 80px",
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.5s ease-out"
              }}
            />
          </svg>
        </div>
        
        {/* Percentage display */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
          <div className="text-2xl font-bold" style={{ color: getColor(accuracy) }}>
            {accuracy}%
          </div>
        </div>
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>Poor</span>
        <span>Good</span>
        <span>Great</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}
