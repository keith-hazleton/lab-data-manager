import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useExperiment, useCreateObservationsBatch } from '../hooks/useApi';
import { useOfflineCages } from '../hooks/useOfflineData';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getTodayDate } from '../utils/formatting';

export function BatchEntry() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const expId = parseInt(experimentId || '0');
  const navigate = useNavigate();

  const { data: experiment } = useExperiment(expId);
  const { data: cages, isLoading } = useOfflineCages(expId);
  const createBatch = useCreateObservationsBatch();

  const [selectedCages, setSelectedCages] = useState<Set<string>>(new Set());
  const [defaultStoolScore, setDefaultStoolScore] = useState(0);
  const [defaultBehaviorScore, setDefaultBehaviorScore] = useState(0);

  const aliveCages = cages?.filter(c => c.alive_count > 0) || [];

  const toggleCage = (cageNumber: string) => {
    const newSelected = new Set(selectedCages);
    if (newSelected.has(cageNumber)) {
      newSelected.delete(cageNumber);
    } else {
      newSelected.add(cageNumber);
    }
    setSelectedCages(newSelected);
  };

  const selectAll = () => {
    setSelectedCages(new Set(aliveCages.map(c => c.cage_number)));
  };

  const deselectAll = () => {
    setSelectedCages(new Set());
  };

  const handleSubmit = async () => {
    const selectedMice = aliveCages
      .filter(c => selectedCages.has(c.cage_number))
      .flatMap(c => c.subjects.filter(s => s.status === 'alive'));

    if (selectedMice.length === 0) return;

    const observations = selectedMice.map(mouse => ({
      subject_id: mouse.id,
      stool_score: defaultStoolScore,
      behavior_score: defaultBehaviorScore,
    }));

    try {
      await createBatch.mutateAsync({
        observation_date: getTodayDate(),
        observations,
      });

      navigate(`/experiment/${expId}`);
    } catch (err) {
      console.error('Failed to create batch observations:', err);
    }
  };

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  const selectedCount = aliveCages
    .filter(c => selectedCages.has(c.cage_number))
    .reduce((sum, c) => sum + c.alive_count, 0);

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/experiment/${expId}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-xl font-bold mt-2">Batch Entry</h1>
        <p className="text-gray-500">{experiment?.name}</p>
      </div>

      <Card>
        <CardBody>
          <p className="text-sm text-gray-600 mb-4">
            Use this to quickly mark multiple mice as &quot;all normal&quot; (score 0 for stool and behavior).
            You can set default scores below.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Stool Score
              </label>
              <select
                value={defaultStoolScore}
                onChange={(e) => setDefaultStoolScore(parseInt(e.target.value))}
                className="input"
              >
                <option value={0}>0 - Normal</option>
                <option value={1}>1 - Soft</option>
                <option value={2}>2 - Loose</option>
                <option value={3}>3 - Watery</option>
                <option value={4}>4 - Bloody</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Behavior Score
              </label>
              <select
                value={defaultBehaviorScore}
                onChange={(e) => setDefaultBehaviorScore(parseInt(e.target.value))}
                className="input"
              >
                <option value={0}>0 - Normal</option>
                <option value={1}>1 - Mild</option>
                <option value={2}>2 - Moderate</option>
                <option value={3}>3 - Severe</option>
                <option value={4}>4 - Critical</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Select Cages</h2>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 hover:underline"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="text-sm text-gray-600 hover:underline"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {aliveCages.map((cage) => {
          const isSelected = selectedCages.has(cage.cage_number);
          return (
            <button
              key={cage.cage_number}
              onClick={() => toggleCage(cage.cage_number)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-bold" style={{ color: cage.treatment_group_color || undefined }}>
                {cage.cage_number}
              </div>
              <div className="text-xs text-gray-500">
                {cage.alive_count} mice
              </div>
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t">
        <Button
          onClick={handleSubmit}
          loading={createBatch.isPending}
          disabled={selectedCount === 0}
          className="w-full"
          size="lg"
        >
          Save {selectedCount} mice
        </Button>
      </div>
    </div>
  );
}
