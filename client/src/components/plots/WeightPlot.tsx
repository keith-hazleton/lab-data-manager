import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeightTimeseriesData, SubjectTimeseries } from '@lab-data-manager/shared';

interface WeightPlotProps {
  data: WeightTimeseriesData[];
  mode: 'median' | 'individual';
  hiddenGroups: Set<string>;
}

export function WeightPlot({ data, mode, hiddenGroups }: WeightPlotProps) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectTimeseries | null>(null);

  // Filter out hidden groups
  const visibleData = useMemo(() =>
    data.filter(group => !hiddenGroups.has(group.treatment_group_name)),
    [data, hiddenGroups]
  );

  if (visibleData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        {data.length === 0 ? 'Select experiments to view weight data' : 'All treatment groups are hidden'}
      </div>
    );
  }

  if (mode === 'median') {
    // Find the day range across all visible groups
    const allDays = new Set<number>();
    visibleData.forEach(group => {
      group.data.forEach(point => allDays.add(point.day_of_study));
    });
    const minDay = Math.min(...allDays);
    const maxDay = Math.max(...allDays);

    // Build chart data with all days for continuous axis
    const chartData = visibleData.flatMap(group =>
      group.data.map(point => ({
        day: point.day_of_study,
        [group.treatment_group_name]: point.value,
      }))
    );

    // Merge data points by day
    const mergedData = new Map<number, Record<string, number>>();
    chartData.forEach(point => {
      const existing = mergedData.get(point.day) || { day: point.day };
      mergedData.set(point.day, { ...existing, ...point });
    });
    const finalData = Array.from(mergedData.values()).sort((a, b) => a.day - b.day);

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={finalData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[minDay, maxDay]}
            label={{ value: 'Day of Study', position: 'insideBottom', offset: -10 }}
            allowDecimals={false}
          />
          <YAxis
            label={{ value: 'Weight (g)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}g`, String(name)]}
            labelFormatter={(label) => `Day ${label}`}
          />
          {visibleData.map((group) => (
            <Line
              key={group.treatment_group_name}
              type="monotone"
              dataKey={group.treatment_group_name}
              stroke={group.color || '#888'}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Individual mode - show all mice with lighter lines
  const allSubjects = visibleData.flatMap(group => group.subjects || []);

  if (allSubjects.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No individual data available
      </div>
    );
  }

  // Find day range
  const allDays = new Set<number>();
  allSubjects.forEach(subject => {
    subject.data.forEach(point => allDays.add(point.day_of_study));
  });
  const minDay = Math.min(...allDays);
  const maxDay = Math.max(...allDays);

  // Build chart data
  const chartData = new Map<number, Record<string, number | undefined>>();
  allSubjects.forEach(subject => {
    subject.data.forEach(point => {
      const existing = chartData.get(point.day_of_study) || { day: point.day_of_study };
      existing[`${subject.subject_id}`] = point.value;
      chartData.set(point.day_of_study, existing);
    });
  });
  const finalData = Array.from(chartData.values()).sort((a, b) => (a.day as number) - (b.day as number));

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={finalData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[minDay, maxDay]}
            label={{ value: 'Day of Study', position: 'insideBottom', offset: -10 }}
            allowDecimals={false}
          />
          <YAxis
            label={{ value: 'Weight (g)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value, name) => {
              const subject = allSubjects.find(s => s.subject_id.toString() === name);
              return [`${Number(value).toFixed(1)}g`, subject?.ear_tag || String(name)];
            }}
            labelFormatter={(label) => `Day ${label}`}
          />
          {allSubjects.map((subject) => (
            <Line
              key={subject.subject_id}
              type="monotone"
              dataKey={`${subject.subject_id}`}
              stroke={subject.color || '#888'}
              strokeWidth={selectedSubject?.subject_id === subject.subject_id ? 3 : 1}
              strokeOpacity={selectedSubject ? (selectedSubject.subject_id === subject.subject_id ? 1 : 0.2) : 0.6}
              dot={false}
              connectNulls
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedSubject(
                selectedSubject?.subject_id === subject.subject_id ? null : subject
              )}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {selectedSubject && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{selectedSubject.ear_tag}</span>
              <span className="text-gray-500 ml-2">{selectedSubject.treatment_group_name}</span>
              <span className="text-gray-400 ml-2">({selectedSubject.experiment_name})</span>
            </div>
            <button
              onClick={() => setSelectedSubject(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {!selectedSubject && allSubjects.length > 0 && (
        <div className="mt-2 text-center text-xs text-gray-400">
          Click on a line to highlight a specific mouse
        </div>
      )}
    </div>
  );
}
