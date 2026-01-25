import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useCreateExperiment } from '../../hooks/useApi';
import { experimentsApi } from '../../api';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { getTodayDate } from '../../utils/formatting';
import type { Sex } from '@lab-data-manager/shared';

interface WizardState {
  step: number;
  experimentName: string;
  description: string;
  startDate: string;
  endpointWeightLoss: number;
  endpointCssThreshold: number;
  baselineDayOffset: number;
  groups: { name: string; description: string; color: string }[];
  cages: { groupIndex: number; cageNumber: string; sex: Sex; count: number; diet: string }[];
  timepoints: { dayOffset: number; name: string; sampleTypes: string[] }[];
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const DEFAULT_STATE: WizardState = {
  step: 1,
  experimentName: '',
  description: '',
  startDate: getTodayDate(),
  endpointWeightLoss: 15,
  endpointCssThreshold: 8,
  baselineDayOffset: 0,
  groups: [{ name: '', description: '', color: COLORS[0] }],
  cages: [],
  timepoints: [],
};

export function ExperimentSetup() {
  const navigate = useNavigate();
  const [state, setState, clearState] = useLocalStorage<WizardState>('experiment-wizard', DEFAULT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createExperiment = useCreateExperiment();

  const updateState = (updates: Partial<WizardState>) => {
    setState({ ...state, ...updates });
  };

  const nextStep = () => updateState({ step: state.step + 1 });
  const prevStep = () => updateState({ step: state.step - 1 });

  const addGroup = () => {
    const newColor = COLORS[state.groups.length % COLORS.length];
    updateState({
      groups: [...state.groups, { name: '', description: '', color: newColor }],
    });
  };

  const updateGroup = (index: number, updates: Partial<WizardState['groups'][0]>) => {
    const newGroups = [...state.groups];
    newGroups[index] = { ...newGroups[index], ...updates };
    updateState({ groups: newGroups });
  };

  const removeGroup = (index: number) => {
    if (state.groups.length <= 1) return;
    const newGroups = state.groups.filter((_, i) => i !== index);
    const newCages = state.cages.filter(c => c.groupIndex !== index).map(c => ({
      ...c,
      groupIndex: c.groupIndex > index ? c.groupIndex - 1 : c.groupIndex,
    }));
    updateState({ groups: newGroups, cages: newCages });
  };

  const addCage = () => {
    updateState({
      cages: [...state.cages, { groupIndex: 0, cageNumber: '', sex: 'F', count: 5, diet: '' }],
    });
  };

  const updateCage = (index: number, updates: Partial<WizardState['cages'][0]>) => {
    const newCages = [...state.cages];
    newCages[index] = { ...newCages[index], ...updates };
    updateState({ cages: newCages });
  };

  const removeCage = (index: number) => {
    updateState({ cages: state.cages.filter((_, i) => i !== index) });
  };

  const addTimepoint = () => {
    updateState({
      timepoints: [...state.timepoints, { dayOffset: 0, name: '', sampleTypes: [] }],
    });
  };

  const updateTimepoint = (index: number, updates: Partial<WizardState['timepoints'][0]>) => {
    const newTimepoints = [...state.timepoints];
    newTimepoints[index] = { ...newTimepoints[index], ...updates };
    updateState({ timepoints: newTimepoints });
  };

  const removeTimepoint = (index: number) => {
    updateState({ timepoints: state.timepoints.filter((_, i) => i !== index) });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Create experiment
      const experiment = await createExperiment.mutateAsync({
        name: state.experimentName,
        description: state.description || undefined,
        start_date: state.startDate,
        baseline_day_offset: state.baselineDayOffset,
        endpoint_weight_loss_pct: state.endpointWeightLoss,
        endpoint_css_threshold: state.endpointCssThreshold,
        endpoint_css_operator: '>=',
      });

      // Create treatment groups
      const groupIds: number[] = [];
      for (let i = 0; i < state.groups.length; i++) {
        const group = state.groups[i];
        const created = await experimentsApi.createGroup(experiment.id, {
          name: group.name,
          description: group.description || undefined,
          color: group.color,
          sort_order: i,
        });
        groupIds.push(created.id);
      }

      // Create subjects (mice) - each cage gets ear tags like "CageNumber.1", "CageNumber.2", etc.
      const { subjectsApi } = await import('../../api/subjects');
      for (const cage of state.cages) {
        const groupId = groupIds[cage.groupIndex];
        if (!groupId) continue;

        await subjectsApi.createBatch({
          experiment_id: experiment.id,
          treatment_group_id: groupId,
          cage_number: cage.cageNumber,
          sex: cage.sex,
          count: cage.count,
          diet: cage.diet || undefined,
        });
      }

      // Create timepoints
      for (const tp of state.timepoints) {
        await experimentsApi.createTimepoint(experiment.id, {
          day_offset: tp.dayOffset,
          name: tp.name,
          sample_types: tp.sampleTypes,
        });
      }

      clearState();
      navigate(`/experiment/${experiment.id}`);
    } catch (err) {
      console.error('Failed to create experiment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalMice = state.cages.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Experiment</h1>
        <div className="text-sm text-gray-500">Step {state.step} of 5</div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${(state.step / 5) * 100}%` }}
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Step 1: Basic Info */}
      {state.step === 1 && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <Input
              label="Experiment Name *"
              value={state.experimentName}
              onChange={(e) => updateState({ experimentName: e.target.value })}
              placeholder="e.g., DSS Colitis Study 2024-01"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={state.description}
                onChange={(e) => updateState({ description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Optional description..."
              />
            </div>
            <Input
              type="date"
              label="Start Date *"
              value={state.startDate}
              onChange={(e) => updateState({ startDate: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                label="Endpoint Weight Loss %"
                value={state.endpointWeightLoss}
                onChange={(e) => updateState({ endpointWeightLoss: parseInt(e.target.value) || 15 })}
              />
              <Input
                type="number"
                label="Endpoint CSS Threshold"
                value={state.endpointCssThreshold}
                onChange={(e) => updateState({ endpointCssThreshold: parseInt(e.target.value) || 8 })}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 2: Treatment Groups */}
      {state.step === 2 && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Treatment Groups</h2>
              <Button size="sm" onClick={addGroup}>+ Add Group</Button>
            </div>
            {state.groups.map((group, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={group.color}
                      onChange={(e) => updateGroup(index, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <span className="text-sm font-medium">Group {index + 1}</span>
                  </div>
                  {state.groups.length > 1 && (
                    <button
                      onClick={() => removeGroup(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  label="Name *"
                  value={group.name}
                  onChange={(e) => updateGroup(index, { name: e.target.value })}
                  placeholder="e.g., Control, DSS 2%, Treatment A"
                />
                <Input
                  label="Description"
                  value={group.description}
                  onChange={(e) => updateGroup(index, { description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Step 3: Cages & Mice */}
      {state.step === 3 && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Cages & Mice</h2>
              <Button size="sm" onClick={addCage}>+ Add Cage</Button>
            </div>
            {state.cages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Add cages with mice for each treatment group
              </p>
            ) : (
              state.cages.map((cage, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">Cage {index + 1}</span>
                    <button
                      onClick={() => removeCage(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Treatment Group"
                      value={cage.groupIndex}
                      onChange={(e) => updateCage(index, { groupIndex: parseInt(e.target.value) })}
                    >
                      {state.groups.map((g, i) => (
                        <option key={i} value={i}>{g.name || `Group ${i + 1}`}</option>
                      ))}
                    </Select>
                    <Input
                      label="Cage Number"
                      value={cage.cageNumber}
                      onChange={(e) => updateCage(index, { cageNumber: e.target.value })}
                      placeholder="e.g., A1"
                    />
                    <Select
                      label="Sex"
                      value={cage.sex}
                      onChange={(e) => updateCage(index, { sex: e.target.value as Sex })}
                    >
                      <option value="F">Female</option>
                      <option value="M">Male</option>
                    </Select>
                    <Input
                      type="number"
                      label="# Mice"
                      value={cage.count}
                      onChange={(e) => updateCage(index, { count: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={10}
                    />
                    <Input
                      label="Diet"
                      value={cage.diet}
                      onChange={(e) => updateCage(index, { diet: e.target.value })}
                      placeholder="e.g., HFt/LFb"
                      className="col-span-2"
                    />
                  </div>
                </div>
              ))
            )}
            <div className="text-sm text-gray-600 text-right">
              Total: {totalMice} mice
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 4: Protocol Timepoints */}
      {state.step === 4 && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Protocol Timepoints</h2>
              <Button size="sm" onClick={addTimepoint}>+ Add Timepoint</Button>
            </div>
            <p className="text-sm text-gray-500">
              Define scheduled sample collection days (optional)
            </p>
            {state.timepoints.map((tp, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium">Timepoint {index + 1}</span>
                  <button
                    onClick={() => removeTimepoint(index)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label="Day"
                    value={tp.dayOffset}
                    onChange={(e) => updateTimepoint(index, { dayOffset: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="Name"
                    value={tp.name}
                    onChange={(e) => updateTimepoint(index, { name: e.target.value })}
                    placeholder="e.g., Baseline, Day 7"
                  />
                </div>
              </div>
            ))}
            {state.timepoints.length === 0 && (
              <p className="text-gray-400 text-center py-4 text-sm">
                No timepoints defined. You can add them later.
              </p>
            )}

            {/* Baseline Day Selection */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <label className="block text-sm font-medium text-blue-900">
                Baseline Day for Weight Loss Calculation
              </label>
              <p className="text-xs text-blue-700">
                Select the day of infection/treatment start. CSS scores will only be collected from this day onward.
              </p>
              <Input
                type="number"
                value={state.baselineDayOffset}
                onChange={(e) => updateState({ baselineDayOffset: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-32"
              />
              <p className="text-xs text-blue-600">
                Day {state.baselineDayOffset} weight will be used as the baseline for % weight change calculations.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 5: Review */}
      {state.step === 5 && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-lg font-semibold">Review & Create</h2>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Experiment</div>
                <div className="font-medium">{state.experimentName}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Start Date</div>
                <div className="font-medium">{state.startDate}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Treatment Groups</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {state.groups.map((g, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded text-sm text-white"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.name || `Group ${i + 1}`}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Cages & Mice</div>
                <div className="font-medium">{state.cages.length} cages, {totalMice} mice</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Baseline Day</div>
                <div className="font-medium">Day {state.baselineDayOffset}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Endpoints</div>
                <div className="font-medium">
                  Weight loss ≥ {state.endpointWeightLoss}% or CSS ≥ {state.endpointCssThreshold}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {state.step > 1 && (
          <Button variant="secondary" onClick={prevStep} className="flex-1">
            Back
          </Button>
        )}
        {state.step < 5 ? (
          <Button
            onClick={nextStep}
            disabled={state.step === 1 && !state.experimentName}
            className="flex-1"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            className="flex-1"
          >
            Create Experiment
          </Button>
        )}
      </div>

      {/* Clear draft */}
      <button
        onClick={clearState}
        className="w-full text-sm text-gray-500 hover:text-gray-700"
      >
        Clear and start over
      </button>
    </div>
  );
}
