import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useExperiment, useRecordExit, useSubjects } from '../hooks/useApi';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScoreButtons } from '../components/features/ScoreButtons';
import { getTodayDate } from '../utils/formatting';
import type { ExitType } from '@lab-data-manager/shared';

const EXIT_TYPES: { value: ExitType; label: string; description: string }[] = [
  { value: 'natural_death', label: 'Found Dead', description: 'Mouse was found dead' },
  { value: 'sacrificed_endpoint', label: 'Endpoint Sacrifice', description: 'Humane endpoint reached' },
  { value: 'sacrificed_scheduled', label: 'Scheduled Sacrifice', description: 'Protocol timepoint' },
  { value: 'excluded', label: 'Excluded', description: 'Removed from study' },
  { value: 'other', label: 'Other', description: 'Other reason' },
];

export function DeathSacrifice() {
  const { experimentId, subjectId } = useParams<{ experimentId: string; subjectId: string }>();
  const expId = parseInt(experimentId || '0');
  const subjId = parseInt(subjectId || '0');
  const navigate = useNavigate();

  const { data: experiment } = useExperiment(expId);
  const { data: subjects, isLoading } = useSubjects(expId);
  const recordExit = useRecordExit();

  const subject = subjects?.find(s => s.id === subjId);

  const [exitType, setExitType] = useState<ExitType | ''>('');
  const [exitDate, setExitDate] = useState(getTodayDate());
  const [exitReason, setExitReason] = useState('');
  const [includeObservation, setIncludeObservation] = useState(true);
  const [finalWeight, setFinalWeight] = useState('');
  const [stoolScore, setStoolScore] = useState<number | undefined>();
  const [behaviorScore, setBehaviorScore] = useState<number | undefined>();
  const [notes, setNotes] = useState('');

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  if (!subject) {
    return (
      <div className="text-center mt-12">
        <p className="text-gray-500">Subject not found</p>
        <Link to={`/experiment/${expId}`} className="text-blue-600 mt-4 inline-block">
          Back to experiment
        </Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!exitType || !exitDate) return;

    try {
      await recordExit.mutateAsync({
        id: subjId,
        input: {
          exit_date: exitDate,
          exit_type: exitType,
          exit_reason: exitReason || undefined,
          final_observation: includeObservation ? {
            weight: finalWeight ? parseFloat(finalWeight) : undefined,
            stool_score: stoolScore,
            behavior_score: behaviorScore,
            notes: notes || undefined,
          } : undefined,
        },
      });

      navigate(`/experiment/${expId}/cages`);
    } catch (err) {
      console.error('Failed to record exit:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/experiment/${expId}/cage/${subject.cage_number}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to cage
        </Link>
        <h1 className="text-xl font-bold mt-2">Record Death / Sacrifice</h1>
        <p className="text-gray-500">{experiment?.name}</p>
      </div>

      {/* Subject info */}
      <Card>
        <CardBody>
          <div className="text-lg font-bold">{subject.ear_tag}</div>
          <div className="text-sm text-gray-500">
            Cage {subject.cage_number} &bull; {subject.treatment_group_name}
          </div>
        </CardBody>
      </Card>

      {/* Exit type */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Exit Type
          </label>
          <div className="space-y-2">
            {EXIT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setExitType(type.value)}
                className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                  exitType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-gray-500">{type.description}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Date and reason */}
      <Card>
        <CardBody className="space-y-4">
          <Input
            type="date"
            label="Date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />
          <Input
            label="Reason / Notes"
            value={exitReason}
            onChange={(e) => setExitReason(e.target.value)}
            placeholder="Optional details..."
          />
        </CardBody>
      </Card>

      {/* Final observation */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Include final observation
            </label>
            <button
              type="button"
              onClick={() => setIncludeObservation(!includeObservation)}
              className={`w-12 h-6 rounded-full transition-colors ${
                includeObservation ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  includeObservation ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {includeObservation && (
            <>
              <Input
                type="number"
                label="Final Weight (g)"
                value={finalWeight}
                onChange={(e) => setFinalWeight(e.target.value)}
                step="0.1"
                inputMode="decimal"
              />
              <ScoreButtons
                type="stool"
                value={stoolScore}
                onChange={setStoolScore}
              />
              <ScoreButtons
                type="behavior"
                value={behaviorScore}
                onChange={setBehaviorScore}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                  rows={2}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Button
        onClick={handleSubmit}
        loading={recordExit.isPending}
        disabled={!exitType || !exitDate}
        variant="danger"
        className="w-full"
        size="lg"
      >
        Record Exit
      </Button>
    </div>
  );
}
