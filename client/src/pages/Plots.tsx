import { useState } from 'react';
import {
  useExperiments,
  useSurvivalData,
  useWeightData,
  useCssData,
  useUnifiedTreatmentGroups,
} from '../hooks/useApi';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PlotControls } from '../components/plots/PlotControls';
import { SurvivalPlot } from '../components/plots/SurvivalPlot';
import { WeightPlot } from '../components/plots/WeightPlot';
import { CssPlot } from '../components/plots/CssPlot';
import type { PlotType, AggregateMode } from '@lab-data-manager/shared';

export function Plots() {
  const { data: experiments, isLoading: loadingExperiments } = useExperiments();

  const [selectedExperimentIds, setSelectedExperimentIds] = useState<number[]>([]);
  const [plotType, setPlotType] = useState<PlotType>('survival');
  const [aggregateMode, setAggregateMode] = useState<AggregateMode>('median');
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());

  // Fetch data based on selected plot type
  const { data: survivalData, isLoading: loadingSurvival } = useSurvivalData(selectedExperimentIds);
  const { data: weightData, isLoading: loadingWeight } = useWeightData(selectedExperimentIds, aggregateMode);
  const { data: cssData, isLoading: loadingCss } = useCssData(selectedExperimentIds, aggregateMode);
  const { data: treatmentGroups } = useUnifiedTreatmentGroups(selectedExperimentIds);

  const toggleExperiment = (id: number) => {
    setSelectedExperimentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleGroup = (name: string) => {
    setHiddenGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const isLoadingPlot =
    (plotType === 'survival' && loadingSurvival) ||
    (plotType === 'weight' && loadingWeight) ||
    (plotType === 'css' && loadingCss);

  if (loadingExperiments) {
    return <LoadingSpinner className="mt-12" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Plots</h1>
        <p className="text-gray-500">Visualize survival, weight, and CSS data across experiments</p>
      </div>

      {/* Controls */}
      <Card>
        <CardBody>
          <PlotControls
            experiments={experiments || []}
            selectedExperimentIds={selectedExperimentIds}
            onExperimentToggle={toggleExperiment}
            plotType={plotType}
            onPlotTypeChange={setPlotType}
            aggregateMode={aggregateMode}
            onAggregateModeChange={setAggregateMode}
          />
        </CardBody>
      </Card>

      {/* Legend - clickable to filter */}
      {treatmentGroups && treatmentGroups.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Treatment Groups</h2>
              <span className="text-xs text-gray-400">Click to show/hide</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {treatmentGroups.map(group => {
                const isHidden = hiddenGroups.has(group.name);
                return (
                  <button
                    key={group.name}
                    onClick={() => toggleGroup(group.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      isHidden
                        ? 'bg-gray-100 border-gray-200 opacity-50'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full transition-opacity ${isHidden ? 'opacity-30' : ''}`}
                      style={{ backgroundColor: group.color || '#888' }}
                    />
                    <span className={`text-sm ${isHidden ? 'line-through text-gray-400' : ''}`}>
                      {group.name}
                      <span className="text-gray-400 ml-1">
                        (n={group.subject_count})
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Plot */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">
            {plotType === 'survival' && 'Survival Curve'}
            {plotType === 'weight' && 'Weight Over Time'}
            {plotType === 'css' && 'CSS Score Over Time'}
            {aggregateMode === 'median' && plotType !== 'survival' && ' (Median)'}
            {aggregateMode === 'individual' && plotType !== 'survival' && ' (Individual)'}
          </h2>
        </CardHeader>
        <CardBody>
          {selectedExperimentIds.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Select one or more experiments to view plots
            </div>
          ) : isLoadingPlot ? (
            <div className="h-80 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {plotType === 'survival' && survivalData && (
                <SurvivalPlot data={survivalData} hiddenGroups={hiddenGroups} />
              )}
              {plotType === 'weight' && weightData && (
                <WeightPlot data={weightData} mode={aggregateMode} hiddenGroups={hiddenGroups} />
              )}
              {plotType === 'css' && cssData && (
                <CssPlot data={cssData} mode={aggregateMode} hiddenGroups={hiddenGroups} />
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Summary stats for survival */}
      {plotType === 'survival' && survivalData && survivalData.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Survival Summary</h2>
          </CardHeader>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {survivalData.map(group => {
                const finalSurvival = group.data.length > 0
                  ? group.data[group.data.length - 1].survival_pct
                  : 100;

                return (
                  <div key={group.treatment_group_name} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color || '#888' }}
                      />
                      <span className="font-medium">{group.treatment_group_name}</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Total subjects: {group.total_subjects}</div>
                      <div>Deaths: {group.total_events}</div>
                      <div>Current survival: {finalSurvival.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
