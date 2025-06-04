
interface AccuracyMeterProps {
  accuracy: number; // 0-100
}

export function AccuracyMeter({ accuracy }: AccuracyMeterProps) {
  const getColor = (acc: number) => {
    if (acc >= 80) return "#10B981"; // green
    if (acc >= 60) return "#F59E0B"; // yellow
    if (acc >= 40) return "#F97316"; // orange
    return "#EF4444"; // red
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        Accuracy
      </h3>
      
      <div className="relative w-20 h-48 mx-auto bg-white border border-gray-300 rounded-lg">
        {/* Scale lines */}
        <div className="absolute right-1 top-2 bottom-2 w-6">
          {[100, 80, 60, 40, 20, 0].map((value, index) => (
            <div key={value} className="absolute right-0 flex items-center" style={{ top: `${index * 20}%` }}>
              <div className="w-2 h-0.5 bg-gray-400" />
              <span className="text-xs text-gray-600 ml-1">{value}</span>
            </div>
          ))}
        </div>

        {/* Main meter area */}
        <div className="absolute left-2 top-2 bottom-2 right-8 border border-gray-200 bg-gray-50 rounded">
          {/* Background zones */}
          <div className="absolute inset-0 rounded overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 bg-red-100" style={{ height: '40%' }} />
            <div className="absolute left-0 right-0 bg-orange-100" style={{ bottom: '40%', height: '20%' }} />
            <div className="absolute left-0 right-0 bg-yellow-100" style={{ bottom: '60%', height: '20%' }} />
            <div className="absolute left-0 right-0 bg-green-100" style={{ bottom: '80%', height: '20%' }} />
          </div>
          
          {/* Accuracy bar */}
          <div 
            className="absolute left-0 right-0 bottom-0 transition-all duration-500 ease-out rounded-b"
            style={{
              height: `${accuracy}%`,
              backgroundColor: getColor(accuracy)
            }}
          />
        </div>
      </div>
      
      {/* Digital readout */}
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: getColor(accuracy) }}>
          {accuracy}%
        </div>
      </div>
    </div>
  );
}
