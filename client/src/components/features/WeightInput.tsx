import { useState, useEffect } from 'react';
import { calculateWeightBarWidth, getWeightChangeClass, formatPercentChange } from '../../utils/formatting';

interface WeightInputProps {
  value: string;
  onChange: (value: string) => void;
  baselineWeight?: number;
  lastWeight?: number;
}

export function WeightInput({ value, onChange, baselineWeight, lastWeight }: WeightInputProps) {
  const [pctChange, setPctChange] = useState<number | null>(null);

  useEffect(() => {
    const weight = parseFloat(value);
    if (!isNaN(weight) && baselineWeight && baselineWeight > 0) {
      const change = ((weight - baselineWeight) / baselineWeight) * 100;
      setPctChange(change);
    } else {
      setPctChange(null);
    }
  }, [value, baselineWeight]);

  const handleKeypadPress = (key: string) => {
    if (key === 'C') {
      onChange('');
    } else if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      onChange(value + key);
    }
  };

  const barWidth = calculateWeightBarWidth(pctChange);
  const changeClass = getWeightChangeClass(pctChange);

  return (
    <div className="space-y-4">
      {/* Weight display */}
      <div className="text-center">
        <div className="text-4xl font-bold mb-2">
          {value || '0'}<span className="text-2xl text-gray-500">g</span>
        </div>
        {pctChange !== null && (
          <div className={`text-lg font-medium ${changeClass}`}>
            {formatPercentChange(pctChange)} from baseline
          </div>
        )}
        {lastWeight && (
          <div className="text-sm text-gray-500">
            Last weight: {lastWeight.toFixed(1)}g
          </div>
        )}
      </div>

      {/* Weight regression bar - fills from right toward left as weight decreases */}
      {baselineWeight && (
        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute right-0 top-0 h-full transition-all duration-300 ${
              pctChange !== null && pctChange <= -15 ? 'bg-red-600' :
              pctChange !== null && pctChange <= -10 ? 'bg-orange-500' :
              pctChange !== null && pctChange <= -5 ? 'bg-yellow-500' :
              'bg-yellow-400'
            }`}
            style={{ width: `${barWidth}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-700">
            <span>-15%</span>
            <span>0%</span>
          </div>
        </div>
      )}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeypadPress(key)}
            className={`keypad-btn ${key === '⌫' ? 'text-red-600' : ''}`}
          >
            {key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange('')}
        className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
      >
        Clear
      </button>
    </div>
  );
}
