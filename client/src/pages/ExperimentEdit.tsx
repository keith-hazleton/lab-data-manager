import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExperiment, useUpdateExperiment, useCages } from '../hooks/useApi';
import { experimentsApi } from '../api';
import { subjectsApi } from '../api/subjects';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { Sex } from '@lab-data-manager/shared';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function ExperimentEdit() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const id = parseInt(experimentId || '0');

  const { data: experiment, isLoading, refetch } = useExperiment(id);
  const { data: cages, refetch: refetchCages } = useCages(id);
  const updateExperiment = useUpdateExperiment();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baselineDayOffset, setBaselineDayOffset] = useState(0);
  const [endpointWeightLoss, setEndpointWeightLoss] = useState(15);
  const [endpointCssThreshold, setEndpointCssThreshold] = useState(8);
  const [initialized, setInitialized] = useState(false);

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(COLORS[0]);

  const [showAddCage, setShowAddCage] = useState(false);
  const [newCageNumber, setNewCageNumber] = useState('');
  const [newCageGroupId, setNewCageGroupId] = useState<number | null>(null);
  const [newCageSex, setNewCageSex] = useState<Sex>('F');
  const [newCageCount, setNewCageCount] = useState(5);
  const [newCageDiet, setNewCageDiet] = useState('');

  const [showAddTimepoint, setShowAddTimepoint] = useState(false);
  const [newTimepointDay, setNewTimepointDay] = useState(0);
  const [newTimepointName, setNewTimepointName] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when experiment loads
  if (experiment && !initialized) {
    setName(experiment.name);
    setDescription(experiment.description || '');
    setBaselineDayOffset(experiment.baseline_day_offset);
    setEndpointWeightLoss(experiment.endpoint_weight_loss_pct);
    setEndpointCssThreshold(experiment.endpoint_css_threshold || 8);
    if (experiment.treatment_groups.length > 0) {
      setNewCageGroupId(experiment.treatment_groups[0].id);
    }
    setInitialized(true);
  }

  if (isLoading || !experiment) {
    return <LoadingSpinner className="mt-12" />;
  }

  const handleSaveBasicInfo = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateExperiment.mutateAsync({
        id,
        input: {
          name,
          description: description || undefined,
          baseline_day_offset: baselineDayOffset,
          endpoint_weight_loss_pct: endpointWeightLoss,
          endpoint_css_threshold: endpointCssThreshold,
        },
      });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName) return;
    setSaving(true);
    try {
      await experimentsApi.createGroup(id, {
        name: newGroupName,
        color: newGroupColor,
        sort_order: experiment.treatment_groups.length,
      });
      setNewGroupName('');
      setNewGroupColor(COLORS[(experiment.treatment_groups.length + 1) % COLORS.length]);
      setShowAddGroup(false);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Delete this treatment group? This will fail if mice are assigned to it.')) return;
    try {
      await experimentsApi.deleteGroup(id, groupId);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group. Make sure no mice are assigned to it.');
    }
  };

  const handleAddCage = async () => {
    if (!newCageNumber || !newCageGroupId) return;
    setSaving(true);
    setError(null);
    try {
      // Each cage gets ear tags like "CageNumber.1", "CageNumber.2", etc.
      await subjectsApi.createBatch({
        experiment_id: id,
        treatment_group_id: newCageGroupId,
        cage_number: newCageNumber,
        sex: newCageSex,
        count: newCageCount,
        diet: newCageDiet || undefined,
      });
      setNewCageNumber('');
      setNewCageDiet('');
      setShowAddCage(false);
      refetch();
      refetchCages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cage');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimepoint = async () => {
    if (!newTimepointName) return;
    setSaving(true);
    setError(null);
    try {
      await experimentsApi.createTimepoint(id, {
        day_offset: newTimepointDay,
        name: newTimepointName,
      });
      setNewTimepointDay(0);
      setNewTimepointName('');
      setShowAddTimepoint(false);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add timepoint');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimepoint = async (timepointId: number) => {
    if (!confirm('Delete this timepoint?')) return;
    try {
      await experimentsApi.deleteTimepoint(id, timepointId);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete timepoint');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to={`/experiment/${id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Experiment</h1>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Basic Information</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Experiment Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <label className="block text-sm font-medium text-blue-900">
              Baseline Day for Weight Loss Calculation
            </label>
            <p className="text-xs text-blue-700">
              CSS scoring only begins from this day. Weight on this day will be used as baseline.
            </p>
            <Input
              type="number"
              value={baselineDayOffset}
              onChange={(e) => setBaselineDayOffset(parseInt(e.target.value) || 0)}
              min={0}
              className="w-32"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Endpoint Weight Loss %"
              type="number"
              value={endpointWeightLoss}
              onChange={(e) => setEndpointWeightLoss(parseInt(e.target.value) || 15)}
            />
            <Input
              label="Endpoint CSS Threshold"
              type="number"
              value={endpointCssThreshold}
              onChange={(e) => setEndpointCssThreshold(parseInt(e.target.value) || 8)}
            />
          </div>
          <Button onClick={handleSaveBasicInfo} loading={saving}>
            Save Changes
          </Button>
        </CardBody>
      </Card>

      {/* Treatment Groups */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Treatment Groups</h2>
            <Button size="sm" onClick={() => setShowAddGroup(!showAddGroup)}>
              + Add Group
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddGroup && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
              <Input
                label="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Control, Treatment A"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewGroupColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newGroupColor === color ? 'border-gray-800' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddGroup} loading={saving}>
                  Add
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowAddGroup(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {experiment.treatment_groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: group.color || '#gray' }}
                  />
                  <div>
                    <div className="font-medium">{group.name}</div>
                    {group.description && (
                      <div className="text-sm text-gray-500">{group.description}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Add Cage */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Cages</h2>
            <Button size="sm" onClick={() => setShowAddCage(!showAddCage)}>
              + Add Cage
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddCage && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Cage Number"
                  value={newCageNumber}
                  onChange={(e) => setNewCageNumber(e.target.value)}
                  placeholder="e.g., A1"
                />
                <Input
                  label="# of Mice"
                  type="number"
                  value={newCageCount}
                  onChange={(e) => setNewCageCount(parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Treatment Group"
                  value={newCageGroupId?.toString() || ''}
                  onChange={(e) => setNewCageGroupId(parseInt(e.target.value))}
                >
                  {experiment.treatment_groups.map((g) => (
                    <option key={g.id} value={g.id.toString()}>{g.name}</option>
                  ))}
                </Select>
                <Select
                  label="Sex"
                  value={newCageSex}
                  onChange={(e) => setNewCageSex(e.target.value as Sex)}
                >
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </Select>
              </div>
              <Input
                label="Diet"
                value={newCageDiet}
                onChange={(e) => setNewCageDiet(e.target.value)}
                placeholder="e.g., HFt/LFb"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCage} loading={saving}>
                  Add Cage
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowAddCage(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-500">
            {cages?.length || 0} cages with {cages?.reduce((sum, c) => sum + c.total_count, 0) || 0} total mice
          </div>
          <p className="text-xs text-gray-400 mt-2">
            To delete a cage, go to the cage detail page from the dashboard.
          </p>
        </CardBody>
      </Card>

      {/* Protocol Timepoints */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Protocol Timepoints</h2>
            <Button size="sm" onClick={() => setShowAddTimepoint(!showAddTimepoint)}>
              + Add Timepoint
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddTimepoint && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Day"
                  type="number"
                  value={newTimepointDay}
                  onChange={(e) => setNewTimepointDay(parseInt(e.target.value) || 0)}
                />
                <Input
                  label="Name"
                  value={newTimepointName}
                  onChange={(e) => setNewTimepointName(e.target.value)}
                  placeholder="e.g., Baseline, Day 7"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddTimepoint} loading={saving}>
                  Add
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowAddTimepoint(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {experiment.protocol_timepoints.length === 0 ? (
            <p className="text-sm text-gray-500">No timepoints defined</p>
          ) : (
            <div className="space-y-2">
              {experiment.protocol_timepoints.map((tp) => (
                <div key={tp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">Day {tp.day_offset}: {tp.name}</div>
                    {tp.description && (
                      <div className="text-sm text-gray-500">{tp.description}</div>
                    )}
                    {tp.sample_types.length > 0 && (
                      <div className="text-xs text-gray-400">
                        Samples: {tp.sample_types.join(', ')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTimepoint(tp.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
