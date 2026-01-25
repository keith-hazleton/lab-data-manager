import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useSubjects, useExperiment, useDeleteCage, useUpdateCage } from '../hooks/useApi';
import { subjectsApi } from '../api/subjects';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getTodayDate, formatWeight, formatPercentChange, getWeightChangeClass, getCssSeverityClass } from '../utils/formatting';
import type { Sex } from '@lab-data-manager/shared';

export function CageDetail() {
  const { experimentId, cageNumber } = useParams<{ experimentId: string; cageNumber: string }>();
  const expId = parseInt(experimentId || '0');
  const navigate = useNavigate();

  const { data: experiment } = useExperiment(expId);
  const { data: subjects, isLoading, refetch } = useSubjects(expId, { cage_number: cageNumber });
  const deleteCage = useDeleteCage();
  const updateCage = useUpdateCage();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCageNumber, setEditCageNumber] = useState(cageNumber || '');
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [editDiet, setEditDiet] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add mice state
  const [showAddMice, setShowAddMice] = useState(false);
  const [addMiceCount, setAddMiceCount] = useState(1);
  const [addMiceSex, setAddMiceSex] = useState<Sex>('F');

  // Filter to only alive mice
  const aliveMice = subjects?.filter(s => s.status === 'alive') || [];
  const currentGroupId = subjects?.[0]?.treatment_group_id;
  const currentDiet = subjects?.[0]?.diet || '';

  // Initialize edit state when subjects load
  if (subjects && subjects.length > 0 && editGroupId === null) {
    setEditGroupId(subjects[0].treatment_group_id);
    setEditDiet(subjects[0].diet || '');
  }

  // Check observation status
  const observedToday = aliveMice.filter(m => m.latest_observation?.observation_date === getTodayDate());
  const needsObservation = aliveMice.filter(m => m.latest_observation?.observation_date !== getTodayDate());
  const allDone = aliveMice.length > 0 && needsObservation.length === 0;

  const handleSaveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: { new_cage_number?: string; treatment_group_id?: number; diet?: string } = {};
      if (editCageNumber !== cageNumber) {
        input.new_cage_number = editCageNumber;
      }
      if (editGroupId && editGroupId !== currentGroupId) {
        input.treatment_group_id = editGroupId;
      }
      if (editDiet !== currentDiet) {
        input.diet = editDiet;
      }

      if (Object.keys(input).length > 0) {
        await updateCage.mutateAsync({ experimentId: expId, cageNumber: cageNumber!, input });
        if (input.new_cage_number) {
          navigate(`/experiment/${expId}/cage/${input.new_cage_number}`, { replace: true });
        } else {
          refetch();
        }
      }
      setShowEdit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMice = async () => {
    if (!currentGroupId) return;
    setSaving(true);
    setError(null);
    try {
      // Find max mouse number in this cage to continue numbering
      let maxNum = 0;
      for (const subject of subjects || []) {
        const parts = subject.ear_tag.split('.');
        if (parts.length === 2) {
          const num = parseInt(parts[1]) || 0;
          if (num > maxNum) maxNum = num;
        }
      }

      await subjectsApi.createBatch({
        experiment_id: expId,
        treatment_group_id: currentGroupId,
        cage_number: cageNumber!,
        sex: addMiceSex,
        count: addMiceCount,
        ear_tag_start: maxNum + 1,
      });
      setShowAddMice(false);
      setAddMiceCount(1);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add mice');
    } finally {
      setSaving(false);
    }
  };

  // Pre-fill normal scores (0, 0) in localStorage for all mice, then go to sequential entry
  const handlePrefillNormalScores = () => {
    const today = getTodayDate();
    for (const mouse of needsObservation) {
      const key = `obs-draft-${mouse.id}-${today}`;
      const draft = {
        weight: '',
        stoolScore: 0,
        behaviorScore: 0,
        notes: '',
      };
      localStorage.setItem(key, JSON.stringify(draft));
    }
    navigate(`/experiment/${expId}/cage/${cageNumber}/entry`);
  };

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Link to={`/experiment/${expId}/cages`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to cages
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-bold">Cage {cageNumber}</h1>
            <p className="text-gray-500">{experiment?.name}</p>
            {currentDiet && (
              <p className="text-sm text-gray-600">Diet: {currentDiet}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allDone && (
              <span className="text-green-600 font-medium px-3 py-1 bg-green-50 rounded-full">
                ✓ All done
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(!showEdit)}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {showEdit && (
        <Card className="border-blue-200 bg-blue-50">
          <CardBody className="space-y-4">
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cage Number"
                value={editCageNumber}
                onChange={(e) => setEditCageNumber(e.target.value)}
              />
              <Select
                label="Treatment Group"
                value={editGroupId?.toString() || ''}
                onChange={(e) => setEditGroupId(parseInt(e.target.value))}
              >
                {experiment?.treatment_groups.map((g) => (
                  <option key={g.id} value={g.id.toString()}>{g.name}</option>
                ))}
              </Select>
              <Input
                label="Diet"
                value={editDiet}
                onChange={(e) => setEditDiet(e.target.value)}
                placeholder="e.g., HFt/LFb"
                className="col-span-2"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} loading={saving}>
                Save Changes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Add Mice */}
      {showEdit && (
        <Card>
          <CardBody>
            {!showAddMice ? (
              <Button size="sm" onClick={() => setShowAddMice(true)}>
                + Add Mice to Cage
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Number of Mice"
                    type="number"
                    value={addMiceCount}
                    onChange={(e) => setAddMiceCount(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                  <Select
                    label="Sex"
                    value={addMiceSex}
                    onChange={(e) => setAddMiceSex(e.target.value as Sex)}
                  >
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddMice} loading={saving}>
                    Add
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddMice(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${(observedToday.length / aliveMice.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-600">
          {observedToday.length}/{aliveMice.length}
        </span>
      </div>

      {/* Entry Options */}
      {needsObservation.length > 0 && (
        <div className="space-y-3">
          <Button
            variant="success"
            onClick={handlePrefillNormalScores}
            className="w-full"
            size="lg"
          >
            All Normal (0,0) - Enter Weights
          </Button>
          <p className="text-center text-sm text-gray-500">
            Pre-fills stool=0, behavior=0 for {needsObservation.length} mice, then enter weights
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">or</span>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => navigate(`/experiment/${expId}/cage/${cageNumber}/entry`)}
            className="w-full"
          >
            Enter All Data Manually
          </Button>
        </div>
      )}

      {/* Mouse List */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">Mice in this cage</h2>
        {aliveMice.map((mouse) => {
          const isObserved = mouse.latest_observation?.observation_date === getTodayDate();
          const lastObs = mouse.latest_observation;

          return (
            <Link
              key={mouse.id}
              to={`/experiment/${expId}/cage/${cageNumber}/mouse/${mouse.id}`}
            >
              <Card
                className={`transition-all active:scale-[0.99] ${
                  isObserved ? 'bg-green-50 border-green-200' : 'hover:border-blue-300'
                }`}
              >
                <CardBody className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold">{mouse.ear_tag}</div>
                      {isObserved && (
                        <span className="text-green-600">✓</span>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      {lastObs ? (
                        <>
                          <div>
                            {formatWeight(lastObs.weight)}{' '}
                            <span className={getWeightChangeClass(lastObs.weight_pct_change)}>
                              {formatPercentChange(lastObs.weight_pct_change)}
                            </span>
                          </div>
                          {lastObs.total_css !== undefined && (
                            <div className={getCssSeverityClass(lastObs.total_css)}>
                              CSS: {lastObs.total_css}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">No observations</span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      {aliveMice.length === 0 && (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            No alive mice in this cage
          </CardBody>
        </Card>
      )}

      {/* Delete Cage */}
      <div className="pt-6 border-t border-gray-200">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete this cage
          </button>
        ) : (
          <Card className="border-red-300 bg-red-50">
            <CardBody>
              <p className="text-red-800 mb-4">
                Delete cage <strong>{cageNumber}</strong> and all {subjects?.length || 0} mice in it?
                <br />
                <span className="text-sm">This will also delete all observations and samples for these mice.</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={deleteCage.isPending}
                  onClick={async () => {
                    await deleteCage.mutateAsync({ experimentId: expId, cageNumber: cageNumber! });
                    navigate(`/experiment/${expId}/cages`);
                  }}
                >
                  Yes, Delete Cage
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
