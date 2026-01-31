import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useExperiment, useCreateSamplesBatch } from '../hooks/useApi';
import { useOfflineSubjects } from '../hooks/useOfflineData';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getTodayDate } from '../utils/formatting';
import type { SampleType } from '@lab-data-manager/shared';

const SAMPLE_TYPES: { value: SampleType; label: string }[] = [
  { value: 'blood', label: 'Blood' },
  { value: 'serum', label: 'Serum' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'stool', label: 'Stool' },
  { value: 'urine', label: 'Urine' },
  { value: 'tissue_liver', label: 'Liver' },
  { value: 'tissue_spleen', label: 'Spleen' },
  { value: 'tissue_kidney', label: 'Kidney' },
  { value: 'tissue_colon', label: 'Colon' },
  { value: 'tissue_small_intestine', label: 'Small Intestine' },
  { value: 'tissue_other', label: 'Other Tissue' },
];

export function SampleCollection() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const expId = parseInt(experimentId || '0');
  const navigate = useNavigate();

  const { data: experiment } = useExperiment(expId);
  const { data: subjects, isLoading } = useOfflineSubjects(expId, { status: 'alive' });
  const createBatch = useCreateSamplesBatch();

  const [selectedMice, setSelectedMice] = useState<Set<number>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<SampleType>>(new Set());
  const [collectionDate, setCollectionDate] = useState(getTodayDate());

  const toggleMouse = (id: number) => {
    const newSelected = new Set(selectedMice);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMice(newSelected);
  };

  const toggleType = (type: SampleType) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedTypes(newSelected);
  };

  const selectAllMice = () => {
    setSelectedMice(new Set(subjects?.map(s => s.id) || []));
  };

  const deselectAllMice = () => {
    setSelectedMice(new Set());
  };

  const handleSubmit = async () => {
    if (selectedMice.size === 0 || selectedTypes.size === 0) return;

    const samples = [];
    for (const mouseId of selectedMice) {
      for (const sampleType of selectedTypes) {
        samples.push({
          subject_id: mouseId,
          sample_type: sampleType,
        });
      }
    }

    try {
      await createBatch.mutateAsync({
        collection_date: collectionDate,
        samples,
      });

      // Navigate to samples list to assign storage
      navigate(`/experiment/${expId}/samples/list`);
    } catch (err) {
      console.error('Failed to create samples:', err);
    }
  };

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  // Group subjects by cage
  const cageMap = new Map<string, typeof subjects>();
  subjects?.forEach(s => {
    const existing = cageMap.get(s.cage_number) || [];
    cageMap.set(s.cage_number, [...existing, s]);
  });

  const totalSamples = selectedMice.size * selectedTypes.size;

  return (
    <div className="space-y-4 pb-24">
      <div>
        <Link to={`/experiment/${expId}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-xl font-bold mt-2">Sample Collection</h1>
        <p className="text-gray-500">{experiment?.name}</p>
      </div>

      {/* Collection date */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Collection Date
          </label>
          <input
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
            className="input"
          />
        </CardBody>
      </Card>

      {/* Sample types */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Sample Types
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TYPES.map((type) => {
              const isSelected = selectedTypes.has(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleType(type.value)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Select mice */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Select Mice</h2>
        <div className="flex gap-2">
          <button
            onClick={selectAllMice}
            className="text-sm text-blue-600 hover:underline"
          >
            Select All
          </button>
          <button
            onClick={deselectAllMice}
            className="text-sm text-gray-600 hover:underline"
          >
            Deselect All
          </button>
        </div>
      </div>

      {Array.from(cageMap.entries()).map(([cageNumber, mice]) => (
        <Card key={cageNumber}>
          <CardBody>
            <div className="font-medium mb-2">Cage {cageNumber}</div>
            <div className="flex flex-wrap gap-2">
              {mice?.map((mouse) => {
                const isSelected = selectedMice.has(mouse.id);
                return (
                  <button
                    key={mouse.id}
                    type="button"
                    onClick={() => toggleMouse(mouse.id)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mouse.ear_tag}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t">
        <div className="text-sm text-gray-600 text-center mb-2">
          {selectedMice.size} mice × {selectedTypes.size} sample types = {totalSamples} samples
        </div>
        <Button
          onClick={handleSubmit}
          loading={createBatch.isPending}
          disabled={totalSamples === 0}
          className="w-full"
          size="lg"
        >
          Create {totalSamples} Samples
        </Button>
      </div>
    </div>
  );
}
