import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SurvivalCurveData } from '@lab-data-manager/shared';

interface SurvivalPlotProps {
  data: SurvivalCurveData[];
  hiddenGroups: Set<string>;
}

export function SurvivalPlot({ data, hiddenGroups }: SurvivalPlotProps) {
  // Filter out hidden groups
  const visibleData = useMemo(() =>
    data.filter(group => !hiddenGroups.has(group.treatment_group_name)),
    [data, hiddenGroups]
  );

  if (visibleData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        {data.length === 0 ? 'Select experiments to view survival curves' : 'All treatment groups are hidden'}
      </div>
    );
  }

  // Find the maximum day across all visible groups
  const maxDay = Math.max(
    ...visibleData.flatMap(d => d.data.map(p => p.day_of_study))
  );

  // Merge all data into a single array for the chart
  const chartData: Record<string, number>[] = [];

  // Create data points for each day
  for (let day = 0; day <= maxDay; day++) {
    const point: Record<string, number> = { day };

    for (const group of visibleData) {
      // Find the latest data point at or before this day
      const relevantPoint = group.data
        .filter(p => p.day_of_study <= day)
        .sort((a, b) => b.day_of_study - a.day_of_study)[0];

      if (relevantPoint) {
        point[group.treatment_group_name] = relevantPoint.survival_pct;
      }
    }

    chartData.push(point);
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          type="number"
          domain={[0, maxDay]}
          label={{ value: 'Day of Study', position: 'insideBottom', offset: -10 }}
          allowDecimals={false}
        />
        <YAxis
          domain={[0, 100]}
          label={{ value: 'Survival (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name)]}
          labelFormatter={(label) => `Day ${label}`}
        />
        {visibleData.map((group) => (
          <Line
            key={group.treatment_group_name}
            type="stepAfter"
            dataKey={group.treatment_group_name}
            stroke={group.color || '#888'}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
