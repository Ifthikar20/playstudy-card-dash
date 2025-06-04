
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
      
      <div className="relative w-32 h-64 mx-auto bg-black rounded-lg p-4">
        {/* Digital-style background */}
        <div className="absolute inset-2 bg-gray-900 rounded border border-gray-600">
          
          {/* Vertical scale lines */}
          <div className="absolute right-2 top-4 bottom-12 w-8">
            {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((value, index) => (
              <div key={value} className="absolute right-0 flex items-center" style={{ top: `${index * 9}%` }}>
                <div className={`w-3 h-0.5 ${value >= 80 ? 'bg-green-400' : value >= 60 ? 'bg-yellow-400' : value >= 40 ? 'bg-orange-400' : 'bg-red-400'}`} />
                <span className="text-xs text-green-400 ml-1 font-mono">{value}</span>
              </div>
            ))}
          </div>

          {/* Main display area */}
          <div className="absolute left-2 top-4 bottom-12 right-12 border border-gray-600 bg-gray-800">
            {/* Needle track */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-700" />
            
            {/* Needle */}
            <div 
              className="absolute left-1/2 w-1 bg-red-500 transition-all duration-500 ease-out origin-bottom"
              style={{
                height: `${accuracy}%`,
                bottom: 0,
                transform: 'translateX(-50%)',
                boxShadow: '0 0 4px rgba(239, 68, 68, 0.8)'
              }}
            />
            
            {/* Accuracy zones background */}
            <div className="absolute inset-0">
              <div className="absolute bottom-0 left-0 right-0 bg-red-900 opacity-30" style={{ height: '40%' }} />
              <div className="absolute left-0 right-0 bg-orange-900 opacity-30" style={{ bottom: '40%', height: '20%' }} />
              <div className="absolute left-0 right-0 bg-yellow-900 opacity-30" style={{ bottom: '60%', height: '20%' }} />
              <div className="absolute left-0 right-0 bg-green-900 opacity-30" style={{ bottom: '80%', height: '20%' }} />
            </div>
          </div>

          {/* Digital readout */}
          <div className="absolute bottom-2 left-2 right-2 bg-black border border-gray-600 rounded px-2 py-1">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold" style={{ color: getColor(accuracy) }}>
                {accuracy.toString().padStart(3, '0')}
              </div>
              <div className="text-xs text-green-400 font-mono">ACCURACY</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-4">
        <span>Poor</span>
        <span>Good</span>
        <span>Great</span>
        <span>Perfect</span>
      </div>
    </div>
  );
}
