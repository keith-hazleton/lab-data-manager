import { useState } from 'react';
import { useFreezers, useStorageBoxes, useBoxDetails, useCreateFreezer, useCreateStorageBox, useUpdateFreezer, useUpdateStorageBox } from '../hooks/useApi';
import { storageApi } from '../api';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { BoxType, Freezer, StorageBox } from '@lab-data-manager/shared';

export function SampleStorage() {
  const { data: freezers, isLoading: loadingFreezers, refetch: refetchFreezers } = useFreezers();
  const { data: boxes, isLoading: loadingBoxes, refetch: refetchBoxes } = useStorageBoxes();
  const createFreezer = useCreateFreezer();
  const createBox = useCreateStorageBox();
  const updateFreezer = useUpdateFreezer();
  const updateBox = useUpdateStorageBox();

  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'ear_tag' | 'sample_type' | 'collection_date' | 'experiment_name'>('ear_tag');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { data: boxDetails } = useBoxDetails(selectedBoxId || 0);

  // Add/Edit Freezer modal state
  const [showFreezerModal, setShowFreezerModal] = useState(false);
  const [editingFreezer, setEditingFreezer] = useState<Freezer | null>(null);
  const [freezerName, setFreezerName] = useState('');
  const [freezerLocation, setFreezerLocation] = useState('');
  const [freezerTemp, setFreezerTemp] = useState('-80');

  // Add/Edit Box modal state
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [editingBox, setEditingBox] = useState<(StorageBox & { freezer_name: string }) | null>(null);
  const [boxName, setBoxName] = useState('');
  const [boxFreezerId, setBoxFreezerId] = useState<number | null>(null);
  const [boxType, setBoxType] = useState<BoxType>('81-well');
  const [boxShelf, setBoxShelf] = useState('');
  const [boxRack, setBoxRack] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group boxes by freezer
  const boxesByFreezer = freezers?.map(freezer => ({
    freezer,
    boxes: boxes?.filter(box => box.freezer_id === freezer.id) || []
  })) || [];

  const openAddFreezer = () => {
    setEditingFreezer(null);
    setFreezerName('');
    setFreezerLocation('');
    setFreezerTemp('-80');
    setShowFreezerModal(true);
  };

  const openEditFreezer = (freezer: Freezer) => {
    setEditingFreezer(freezer);
    setFreezerName(freezer.name);
    setFreezerLocation(freezer.location || '');
    setFreezerTemp(freezer.temperature?.toString() || '-80');
    setShowFreezerModal(true);
  };

  const openAddBox = (freezerId?: number) => {
    setEditingBox(null);
    setBoxName('');
    setBoxFreezerId(freezerId || (freezers && freezers.length > 0 ? freezers[0].id : null));
    setBoxType('81-well');
    setBoxShelf('');
    setBoxRack('');
    setShowBoxModal(true);
  };

  const openEditBox = (box: StorageBox & { freezer_name: string }) => {
    setEditingBox(box);
    setBoxName(box.name);
    setBoxFreezerId(box.freezer_id);
    setBoxType(box.box_type);
    setBoxShelf(box.shelf || '');
    setBoxRack(box.rack || '');
    setShowBoxModal(true);
  };

  const handleSaveFreezer = async () => {
    if (!freezerName) return;
    setSaving(true);
    setError(null);
    try {
      if (editingFreezer) {
        await updateFreezer.mutateAsync({
          id: editingFreezer.id,
          input: {
            name: freezerName,
            location: freezerLocation || undefined,
            temperature: freezerTemp ? parseFloat(freezerTemp) : undefined,
          }
        });
      } else {
        await createFreezer.mutateAsync({
          name: freezerName,
          location: freezerLocation || undefined,
          temperature: freezerTemp ? parseFloat(freezerTemp) : undefined,
        });
      }
      setShowFreezerModal(false);
      refetchFreezers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save freezer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFreezer = async (id: number) => {
    if (!confirm('Delete this freezer and all its boxes?')) return;
    try {
      await storageApi.deleteFreezer(id);
      refetchFreezers();
      refetchBoxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete freezer');
    }
  };

  const handleSaveBox = async () => {
    if (!boxName || !boxFreezerId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingBox) {
        await updateBox.mutateAsync({
          id: editingBox.id,
          input: {
            freezer_id: boxFreezerId,
            name: boxName,
            box_type: boxType,
            shelf: boxShelf || undefined,
            rack: boxRack || undefined,
          }
        });
      } else {
        await createBox.mutateAsync({
          freezer_id: boxFreezerId,
          name: boxName,
          box_type: boxType,
          shelf: boxShelf || undefined,
          rack: boxRack || undefined,
        });
      }
      setShowBoxModal(false);
      refetchFreezers();
      refetchBoxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save box');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBox = async (id: number) => {
    if (!confirm('Delete this storage box?')) return;
    try {
      await storageApi.deleteBox(id);
      refetchFreezers();
      refetchBoxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete box');
    }
  };

  if (loadingFreezers || loadingBoxes) {
    return <LoadingSpinner className="mt-12" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sample Storage</h1>
        <Button onClick={openAddFreezer}>+ Add Freezer</Button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Freezers with their boxes */}
      {freezers && freezers.length > 0 ? (
        <div className="space-y-6">
          {boxesByFreezer.map(({ freezer, boxes: freezerBoxes }) => (
            <Card key={freezer.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{freezer.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {freezer.location && <span>{freezer.location}</span>}
                        {freezer.temperature && (
                          <span className="font-medium text-blue-600">
                            {freezer.temperature}°C
                          </span>
                        )}
                        <span>
                          {freezer.total_samples} / {freezer.total_capacity} samples
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openAddBox(freezer.id)}>
                      + Add Box
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEditFreezer(freezer)}>
                      Edit
                    </Button>
                    <button
                      onClick={() => handleDeleteFreezer(freezer.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                {freezerBoxes.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {freezerBoxes.map((box) => (
                      <div
                        key={box.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => setSelectedBoxId(box.id)}
                          >
                            <h4 className="font-medium">{box.name}</h4>
                            <div className="text-xs text-gray-500">
                              {box.box_type}
                              {(box.shelf || box.rack) && (
                                <span className="ml-2">
                                  {box.shelf && `Shelf ${box.shelf}`}
                                  {box.shelf && box.rack && ' / '}
                                  {box.rack && `Rack ${box.rack}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {box.occupied_positions}/{box.total_positions}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditBox(box);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(box.occupied_positions / box.total_positions) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No boxes in this freezer yet
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            No freezers yet. Add a freezer to start organizing your samples.
          </CardBody>
        </Card>
      )}

      {/* Box Contents Modal */}
      <Modal
        isOpen={selectedBoxId !== null}
        onClose={() => setSelectedBoxId(null)}
        title={boxDetails?.name || 'Box'}
      >
        {boxDetails && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>{boxDetails.freezer_name}</span>
              <span>{boxDetails.samples.length} samples</span>
            </div>

            {boxDetails.samples.length > 0 ? (
              <>
                {/* Sort controls */}
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-500">Sort by:</span>
                  {(['ear_tag', 'sample_type', 'collection_date', 'experiment_name'] as const).map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        if (sortField === field) {
                          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(field);
                          setSortDir('asc');
                        }
                      }}
                      className={`px-2 py-1 rounded ${
                        sortField === field
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {field === 'ear_tag' ? 'Mouse' :
                       field === 'sample_type' ? 'Type' :
                       field === 'collection_date' ? 'Date' : 'Experiment'}
                      {sortField === field && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  ))}
                </div>

                {/* Sample list */}
                <div className="max-h-96 overflow-y-auto divide-y">
                  {[...boxDetails.samples]
                    .sort((a, b) => {
                      const aVal = a[sortField] || '';
                      const bVal = b[sortField] || '';
                      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                      return sortDir === 'asc' ? cmp : -cmp;
                    })
                    .map((sample) => (
                      <div key={sample.id} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-medium">{sample.ear_tag}</span>
                          <span className="text-gray-500 ml-2">{sample.sample_type}</span>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{sample.collection_date}</div>
                          <div className="text-xs">{sample.experiment_name}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No samples in this box yet.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Freezer Modal */}
      <Modal
        isOpen={showFreezerModal}
        onClose={() => setShowFreezerModal(false)}
        title={editingFreezer ? 'Edit Freezer' : 'Add Freezer'}
      >
        <div className="space-y-4">
          <Input
            label="Freezer Name *"
            value={freezerName}
            onChange={(e) => setFreezerName(e.target.value)}
            placeholder="e.g., -80C Freezer 1"
          />
          <Input
            label="Location"
            value={freezerLocation}
            onChange={(e) => setFreezerLocation(e.target.value)}
            placeholder="e.g., Room 101"
          />
          <Input
            label="Temperature (C)"
            type="number"
            value={freezerTemp}
            onChange={(e) => setFreezerTemp(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowFreezerModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFreezer} loading={saving} disabled={!freezerName}>
              {editingFreezer ? 'Save Changes' : 'Add Freezer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Box Modal */}
      <Modal
        isOpen={showBoxModal}
        onClose={() => setShowBoxModal(false)}
        title={editingBox ? 'Edit Storage Box' : 'Add Storage Box'}
      >
        <div className="space-y-4">
          {freezers && freezers.length > 0 ? (
            <>
              <Select
                label="Freezer *"
                value={boxFreezerId?.toString() || ''}
                onChange={(e) => setBoxFreezerId(parseInt(e.target.value))}
              >
                {freezers.map((f) => (
                  <option key={f.id} value={f.id.toString()}>{f.name}</option>
                ))}
              </Select>
              <Input
                label="Box Name *"
                value={boxName}
                onChange={(e) => setBoxName(e.target.value)}
                placeholder="e.g., Box A1"
              />
              <Select
                label="Box Type"
                value={boxType}
                onChange={(e) => setBoxType(e.target.value as BoxType)}
                disabled={!!editingBox}
              >
                <option value="81-well">81-well (9x9)</option>
                <option value="100-well">100-well (10x10)</option>
                <option value="25-well">25-well (5x5)</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Shelf"
                  value={boxShelf}
                  onChange={(e) => setBoxShelf(e.target.value)}
                  placeholder="e.g., 1"
                />
                <Input
                  label="Rack"
                  value={boxRack}
                  onChange={(e) => setBoxRack(e.target.value)}
                  placeholder="e.g., A"
                />
              </div>
              {editingBox && (
                <div className="pt-2 border-t">
                  <button
                    onClick={() => {
                      handleDeleteBox(editingBox.id);
                      setShowBoxModal(false);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete this box
                  </button>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowBoxModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveBox} loading={saving} disabled={!boxName || !boxFreezerId}>
                  {editingBox ? 'Save Changes' : 'Add Box'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">Add a freezer first before creating storage boxes.</p>
              <Button onClick={() => {
                setShowBoxModal(false);
                openAddFreezer();
              }}>
                Add Freezer
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
