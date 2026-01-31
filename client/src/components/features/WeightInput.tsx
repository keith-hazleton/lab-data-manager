import { useState, useEffect, useRef } from 'react';
import { calculateWeightBarWidth, getWeightChangeClass, formatPercentChange } from '../../utils/formatting';

interface WeightInputProps {
  value: string;
  onChange: (value: string) => void;
  baselineWeight?: number;
  lastWeight?: number;
}

export function WeightInput({ value, onChange, baselineWeight, lastWeight }: WeightInputProps) {
  const [pctChange, setPctChange] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const weight = parseFloat(value);
    if (!isNaN(weight) && baselineWeight && baselineWeight > 0) {
      const change = ((weight - baselineWeight) / baselineWeight) * 100;
      setPctChange(change);
    } else {
      setPctChange(null);
    }
  }, [value, baselineWeight]);

  const barWidth = calculateWeightBarWidth(pctChange);
  const changeClass = getWeightChangeClass(pctChange);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Weight (g)</label>

      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lastWeight ? `Last: ${lastWeight.toFixed(1)}` : 'Enter weight'}
        className="w-full text-2xl font-bold text-center px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {pctChange !== null && (
        <div className={`text-center text-sm font-medium ${changeClass}`}>
          {formatPercentChange(pctChange)} from baseline
        </div>
      )}

      {/* Weight regression bar */}
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
    </div>
  );
}
