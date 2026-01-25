import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExperiment, useSamples, useStorageBoxes } from '../hooks/useApi';
import { samplesApi } from '../api/samples';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { formatDateShort } from '../utils/formatting';
import type { SampleWithSubject } from '@lab-data-manager/shared';

export function SamplesList() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const expId = parseInt(experimentId || '0');

  const { data: experiment } = useExperiment(expId);
  const { data: samples, isLoading, refetch } = useSamples(expId);
  const { data: boxes } = useStorageBoxes();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStorage, setFilterStorage] = useState<string>('all');

  // Multi-select state
  const [selectedSamples, setSelectedSamples] = useState<Set<number>>(new Set());

  // Storage assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Get unique sample types
  const sampleTypes = [...new Set(samples?.map(s => s.sample_type) || [])];

  // Filter samples
  const filteredSamples = samples?.filter(s => {
    if (filterType !== 'all' && s.sample_type !== filterType) return false;
    if (filterStorage === 'stored' && !s.storage_box_id) return false;
    if (filterStorage === 'unstored' && s.storage_box_id) return false;
    return true;
  }) || [];

  // Group by collection date
  const samplesByDate = new Map<string, SampleWithSubject[]>();
  filteredSamples.forEach(s => {
    const existing = samplesByDate.get(s.collection_date) || [];
    samplesByDate.set(s.collection_date, [...existing, s]);
  });

  const toggleSample = (id: number) => {
    const newSelected = new Set(selectedSamples);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSamples(newSelected);
  };

  const selectAllFiltered = () => {
    setSelectedSamples(new Set(filteredSamples.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSamples(new Set());
  };

  const selectUnstored = () => {
    setSelectedSamples(new Set(filteredSamples.filter(s => !s.storage_box_id).map(s => s.id)));
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

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  const storedCount = samples?.filter(s => s.storage_box_id).length || 0;
  const unstoredCount = (samples?.length || 0) - storedCount;
  const selectedCount = selectedSamples.size;

  return (
    <div className="space-y-4 pb-24">
      <div>
        <Link to={`/experiment/${expId}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-xl font-bold mt-2">Samples</h1>
        <p className="text-gray-500">{experiment?.name}</p>
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
        <CardBody className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Sample Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              {sampleTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Storage Status</label>
            <select
              value={filterStorage}
              onChange={(e) => setFilterStorage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All</option>
              <option value="stored">Stored</option>
              <option value="unstored">Unstored</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={selectAllFiltered} className="text-sm text-blue-600 hover:underline">
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

      {/* Samples by date */}
      {samplesByDate.size > 0 ? (
        Array.from(samplesByDate.entries()).map(([date, dateSamples]) => (
          <Card key={date}>
            <CardBody>
              <h3 className="font-medium mb-3">
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
        ))
      ) : (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            No samples collected yet.
            <div className="mt-4">
              <Link to={`/experiment/${expId}/samples`}>
                <Button>Collect Samples</Button>
              </Link>
            </div>
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
