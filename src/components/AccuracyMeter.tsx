
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
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Accuracy
      </h3>
      
      <div className="relative w-8 h-32 lg:h-40 bg-card border border-border rounded-md">
        {/* Scale lines */}
        <div className="absolute right-0 top-0 bottom-0 w-6">
          {[100, 80, 60, 40, 20, 0].map((value, index) => (
            <div key={value} className="absolute right-0 flex items-center" style={{ top: `${index * 20}%` }}>
              <div className="w-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground ml-1">{value}</span>
            </div>
          ))}
        </div>

        {/* Main meter area */}
        <div className="absolute left-0 top-1 bottom-1 right-4 border border-border bg-muted rounded-sm">
          {/* Background zones */}
          <div className="absolute inset-0 rounded-sm overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 bg-red-100 dark:bg-red-900/20" style={{ height: '40%' }} />
            <div className="absolute left-0 right-0 bg-orange-100 dark:bg-orange-900/20" style={{ bottom: '40%', height: '20%' }} />
            <div className="absolute left-0 right-0 bg-yellow-100 dark:bg-yellow-900/20" style={{ bottom: '60%', height: '20%' }} />
            <div className="absolute left-0 right-0 bg-green-100 dark:bg-green-900/20" style={{ bottom: '80%', height: '20%' }} />
          </div>
          
          {/* Accuracy bar */}
          <div 
            className="absolute left-0 right-0 bottom-0 transition-all duration-500 ease-out rounded-b-sm"
            style={{
              height: `${accuracy}%`,
              backgroundColor: getColor(accuracy)
            }}
          />
        </div>
      </div>
      
      {/* Digital readout */}
      <div className="mt-2 text-center">
        <div className="text-lg font-bold" style={{ color: getColor(accuracy) }}>
          {accuracy}%
        </div>
      </div>
    </div>
  );
}
