import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useExperiments, useGlobalSamples, useStorageBoxes } from '../hooks/useApi';
import { samplesApi } from '../api/samples';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { formatDateShort } from '../utils/formatting';
import type { GlobalSampleWithSubject } from '@lab-data-manager/shared';

export function GlobalSamplesBrowser() {
  const { data: experiments } = useExperiments();
  const { data: boxes } = useStorageBoxes();

  // Filter state
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<number[]>([]);
  const [selectedSampleTypes, setSelectedSampleTypes] = useState<string[]>([]);
  const [storageStatus, setStorageStatus] = useState<'all' | 'stored' | 'unstored'>('all');

  // Build filters object for the query
  const filters = useMemo(() => ({
    experiment_ids: selectedExperimentIds.length > 0 ? selectedExperimentIds : undefined,
    sample_types: selectedSampleTypes.length > 0 ? selectedSampleTypes : undefined,
    storage_status: storageStatus,
  }), [selectedExperimentIds, selectedSampleTypes, storageStatus]);

  const { data: samples, isLoading, refetch } = useGlobalSamples(filters);

  // Multi-select state for batch operations
  const [selectedSamples, setSelectedSamples] = useState<Set<number>>(new Set());

  // Storage assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Get unique sample types from current results
  const availableSampleTypes = useMemo(() => {
    return [...new Set(samples?.map(s => s.sample_type) || [])].sort();
  }, [samples]);

  // Group by experiment, then by collection date
  const groupedSamples = useMemo(() => {
    const byExperiment = new Map<number, { name: string; byDate: Map<string, GlobalSampleWithSubject[]> }>();

    samples?.forEach(s => {
      if (!byExperiment.has(s.experiment_id)) {
        byExperiment.set(s.experiment_id, { name: s.experiment_name, byDate: new Map() });
      }
      const exp = byExperiment.get(s.experiment_id)!;
      if (!exp.byDate.has(s.collection_date)) {
        exp.byDate.set(s.collection_date, []);
      }
      exp.byDate.get(s.collection_date)!.push(s);
    });

    return byExperiment;
  }, [samples]);

  const toggleSample = (id: number) => {
    const newSelected = new Set(selectedSamples);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSamples(newSelected);
  };

  const selectAll = () => {
    setSelectedSamples(new Set(samples?.map(s => s.id) || []));
  };

  const deselectAll = () => {
    setSelectedSamples(new Set());
  };

  const selectUnstored = () => {
    setSelectedSamples(new Set(samples?.filter(s => !s.storage_box_id).map(s => s.id) || []));
  };

  const toggleExperimentFilter = (id: number) => {
    setSelectedExperimentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSampleTypeFilter = (type: string) => {
    setSelectedSampleTypes(prev =>
      prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]
    );
  };

  const openAssignModal = () => {
    if (selectedSamples.size === 0) return;
    setSelectedBoxId(boxes && boxes.length > 0 ? boxes[0].id : null);
    setShowAssignModal(true);
  };

  const handleBatchAssign = async () => {
    if (!selectedBoxId || selectedSamples.size === 0) return;
    setSaving(true);
    try {
      await samplesApi.batchAssignToStorage(Array.from(selectedSamples), selectedBoxId);
      setShowAssignModal(false);
      setSelectedSamples(new Set());
      refetch();
    } catch (err) {
      console.error('Failed to assign samples:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchRemove = async () => {
    if (selectedSamples.size === 0) return;
    if (!confirm(`Remove ${selectedSamples.size} samples from storage?`)) return;
    setSaving(true);
    try {
      await samplesApi.batchRemoveFromStorage(Array.from(selectedSamples));
      setSelectedSamples(new Set());
      refetch();
    } catch (err) {
      console.error('Failed to remove samples from storage:', err);
    } finally {
      setSaving(false);
    }
  };

  const storedCount = samples?.filter(s => s.storage_box_id).length || 0;
  const unstoredCount = (samples?.length || 0) - storedCount;
  const selectedCount = selectedSamples.size;

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold">All Samples</h1>
        <p className="text-gray-500">Browse and manage samples across all experiments</p>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="px-3 py-1 bg-gray-100 rounded-full">
          {samples?.length || 0} total
        </span>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
          {storedCount} stored
        </span>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
          {unstoredCount} unstored
        </span>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-4">
          {/* Experiment filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Experiments</label>
            <div className="flex flex-wrap gap-2">
              {experiments?.map(exp => {
                const isSelected = selectedExperimentIds.includes(exp.id);
                return (
                  <button
                    key={exp.id}
                    onClick={() => toggleExperimentFilter(exp.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {exp.name}
                  </button>
                );
              })}
              {selectedExperimentIds.length > 0 && (
                <button
                  onClick={() => setSelectedExperimentIds([])}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Sample type and storage filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-2">Sample Types</label>
              <div className="flex flex-wrap gap-2">
                {availableSampleTypes.map(type => {
                  const isSelected = selectedSampleTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => toggleSampleTypeFilter(type)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Storage</label>
              <div className="flex gap-1">
                {(['all', 'stored', 'unstored'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStorageStatus(status)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${
                      storageStatus === status
                        ? 'bg-gray-700 border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">
          Select All
        </button>
        <span className="text-gray-300">|</span>
        <button onClick={selectUnstored} className="text-sm text-blue-600 hover:underline">
          Select Unstored
        </button>
        <span className="text-gray-300">|</span>
        <button onClick={deselectAll} className="text-sm text-gray-600 hover:underline">
          Deselect All
        </button>
        {selectedCount > 0 && (
          <span className="ml-auto text-sm font-medium text-blue-600">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Samples grouped by experiment and date */}
      {isLoading ? (
        <LoadingSpinner className="mt-12" />
      ) : groupedSamples.size > 0 ? (
        Array.from(groupedSamples.entries()).map(([expId, { name, byDate }]) => (
          <div key={expId} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">{name}</h2>
            {Array.from(byDate.entries()).map(([date, dateSamples]) => (
              <Card key={`${expId}-${date}`}>
                <CardBody>
                  <h3 className="font-medium mb-3 text-sm">
                    {formatDateShort(date)} - Day {dateSamples[0]?.day_of_study}
                  </h3>
                  <div className="space-y-2">
                    {dateSamples.map(sample => {
                      const isSelected = selectedSamples.has(sample.id);
                      return (
                        <div
                          key={sample.id}
                          onClick={() => toggleSample(sample.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-2 border-blue-300'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSample(sample.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sample.treatment_group_color || '#gray' }}
                            />
                            <div>
                              <span className="font-medium">{sample.ear_tag}</span>
                              <span className="text-gray-500 ml-2">{sample.sample_type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sample.storage_box_id ? (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                {sample.storage_location}
                              </span>
                            ) : (
                              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                Unstored
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ))
      ) : (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            {selectedExperimentIds.length > 0 || selectedSampleTypes.length > 0 || storageStatus !== 'all'
              ? 'No samples match the current filters.'
              : 'No samples collected yet. Collect samples from within an experiment.'}
          </CardBody>
        </Card>
      )}

      {/* Fixed bottom action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <div className="flex gap-2 justify-center">
            <Button onClick={openAssignModal} disabled={!boxes || boxes.length === 0}>
              Assign {selectedCount} to Box
            </Button>
            <Button variant="secondary" onClick={handleBatchRemove} loading={saving}>
              Remove from Storage
            </Button>
          </div>
        </div>
      )}

      {/* Assign to Box Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Samples to Storage Box"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign {selectedCount} samples to a storage box.
          </p>

          {boxes && boxes.length > 0 ? (
            <>
              <Select
                label="Storage Box"
                value={selectedBoxId?.toString() || ''}
                onChange={(e) => setSelectedBoxId(parseInt(e.target.value))}
              >
                {boxes.map(box => (
                  <option key={box.id} value={box.id.toString()}>
                    {box.freezer_name} / {box.name}
                  </option>
                ))}
              </Select>

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchAssign}
                  loading={saving}
                  disabled={!selectedBoxId}
                >
                  Assign
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">
                Add a freezer and storage boxes first.
              </p>
              <Link to="/storage">
                <Button>Go to Sample Storage</Button>
              </Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
