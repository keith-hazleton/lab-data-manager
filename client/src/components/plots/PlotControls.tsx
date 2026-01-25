import type { PlotType, AggregateMode } from '@lab-data-manager/shared';

interface Experiment {
  id: number;
  name: string;
}

interface PlotControlsProps {
  experiments: Experiment[];
  selectedExperimentIds: number[];
  onExperimentToggle: (id: number) => void;
  plotType: PlotType;
  onPlotTypeChange: (type: PlotType) => void;
  aggregateMode: AggregateMode;
  onAggregateModeChange: (mode: AggregateMode) => void;
}

export function PlotControls({
  experiments,
  selectedExperimentIds,
  onExperimentToggle,
  plotType,
  onPlotTypeChange,
  aggregateMode,
  onAggregateModeChange,
}: PlotControlsProps) {
  const plotTypes: { value: PlotType; label: string }[] = [
    { value: 'survival', label: 'Survival' },
    { value: 'weight', label: 'Weight' },
    { value: 'css', label: 'CSS' },
  ];

  const aggregateModes: { value: AggregateMode; label: string }[] = [
    { value: 'median', label: 'Median' },
    { value: 'individual', label: 'Individual' },
  ];

  return (
    <div className="space-y-4">
      {/* Experiment selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Experiments
        </label>
        <div className="flex flex-wrap gap-2">
          {experiments.map(exp => {
            const isSelected = selectedExperimentIds.includes(exp.id);
            return (
              <button
                key={exp.id}
                onClick={() => onExperimentToggle(exp.id)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {exp.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plot type and aggregate mode */}
      <div className="flex gap-6">
        {/* Plot type toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plot Type
          </label>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {plotTypes.map(type => (
              <button
                key={type.value}
                onClick={() => onPlotTypeChange(type.value)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  plotType === type.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aggregate mode toggle (only for weight/css) */}
        {plotType !== 'survival' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View Mode
            </label>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {aggregateModes.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => onAggregateModeChange(mode.value)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    aggregateMode === mode.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
