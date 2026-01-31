import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useExperiment, useCreateObservation } from '../hooks/useApi';
import { useOfflineSubjects } from '../hooks/useOfflineData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Card, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WeightInput } from '../components/features/WeightInput';
import { ScoreButtons } from '../components/features/ScoreButtons';
import { CssDisplay } from '../components/features/CssDisplay';
import { getTodayDate, formatWeight, formatPercentChange, getWeightChangeClass, getDayOfStudy, formatDateShort } from '../utils/formatting';
import { getWeightScore } from '@lab-data-manager/shared';
import type { EndpointAlert } from '@lab-data-manager/shared';

interface ObservationDraft {
  weight: string;
  stoolScore?: number;
  behaviorScore?: number;
  notes: string;
}

export function MouseEntry() {
  const { experimentId, cageNumber, mouseId } = useParams<{ experimentId: string; cageNumber: string; mouseId?: string }>();
  const [searchParams] = useSearchParams();
  const expId = parseInt(experimentId || '0');
  const specificMouseId = mouseId ? parseInt(mouseId) : null;
  const navigate = useNavigate();

  // Get date from query param, default to today
  const dateParam = searchParams.get('date');
  const observationDate = dateParam || getTodayDate();
  const isEditingPastDay = dateParam !== null && dateParam !== getTodayDate();

  const { data: experiment } = useExperiment(expId);
  // If editing a past day, get subjects that were alive on that date with observations for that date
  const { data: subjects, isLoading } = useOfflineSubjects(expId, {
    cage_number: cageNumber,
    ...(isEditingPastDay ? { observation_date: observationDate } : { status: 'alive' }),
  });
  const createObservation = useCreateObservation();

  // Calculate if we're before the baseline day (no CSS scoring needed)
  // Use the observation date for day calculation, not today
  const dayOfStudy = experiment ? getDayOfStudy(experiment.start_date, observationDate) : 0;
  const isBeforeBaseline = experiment ? dayOfStudy < experiment.baseline_day_offset : false;

  // For past days, subjects are already filtered by alive_on_date; for today, filter to alive
  const aliveMice = isEditingPastDay
    ? (subjects || [])
    : (subjects?.filter(s => s.status === 'alive') || []);

  // If specific mouse ID provided, use single-mouse mode
  const isSingleMouseMode = specificMouseId !== null;
  const singleMouseIndex = specificMouseId ? aliveMice.findIndex(m => m.id === specificMouseId) : -1;

  // Current mouse index
  const [currentIndex, setCurrentIndex] = useState(0);

  // In single mouse mode, use the specific mouse; otherwise use sequential index
  const effectiveIndex = isSingleMouseMode ? singleMouseIndex : currentIndex;
  const currentMouse = aliveMice[effectiveIndex];

  // Check if already observed on the target date
  const existingObservation = currentMouse?.latest_observation?.observation_date === observationDate
    ? currentMouse.latest_observation
    : null;

  // Form state with localStorage backup for unsaved drafts
  const storageKey = currentMouse ? `obs-draft-${currentMouse.id}-${observationDate}` : '';
  const [draft, setDraft, clearDraft] = useLocalStorage<ObservationDraft>(storageKey, {
    weight: '',
    stoolScore: undefined,
    behaviorScore: undefined,
    notes: '',
  });

  // Load existing observation data into form when mouse changes
  const [initialized, setInitialized] = useState<number | null>(null);
  useEffect(() => {
    if (currentMouse && currentMouse.id !== initialized) {
      if (existingObservation) {
        // Load from today's saved observation
        setDraft({
          weight: existingObservation.weight?.toString() ?? '',
          stoolScore: existingObservation.stool_score,
          behaviorScore: existingObservation.behavior_score,
          notes: existingObservation.notes ?? '',
        });
      }
      setInitialized(currentMouse.id);
    }
  }, [currentMouse?.id, existingObservation, initialized]);

  // Alerts from last save
  const [alerts, setAlerts] = useState<EndpointAlert[]>([]);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Calculate weight score for CSS display
  // Use baseline_weight, or if not set, treat current weight as baseline (Day 0)
  const weightValue = parseFloat(draft.weight);
  const baselineWeight = currentMouse?.baseline_weight || (existingObservation?.weight ?? undefined);
  const weightPctChange = !isNaN(weightValue) && baselineWeight
    ? ((weightValue - baselineWeight) / baselineWeight) * 100
    : null;
  const weightScore = weightPctChange !== null ? getWeightScore(weightPctChange) : null;

  useEffect(() => {
    setAlerts([]);
    setShowSaveSuccess(false);
  }, [currentIndex]);

  const handleSave = async () => {
    if (!currentMouse) return;

    const weight = parseFloat(draft.weight);

    try {
      const result = await createObservation.mutateAsync({
        subject_id: currentMouse.id,
        observation_date: observationDate,
        weight: !isNaN(weight) ? weight : undefined,
        stool_score: draft.stoolScore,
        behavior_score: draft.behaviorScore,
        notes: draft.notes || undefined,
      });

      setAlerts(result.alerts);
      setShowSaveSuccess(true);
      clearDraft();

      // Auto-advance after short delay
      setTimeout(() => {
        if (isSingleMouseMode) {
          navigate(backUrl);
        } else if (currentIndex < aliveMice.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to save observation:', err);
    }
  };

  const handleNext = () => {
    if (isSingleMouseMode) {
      // In single mouse mode, go back
      navigate(backUrl);
    } else if (currentIndex < aliveMice.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All done, go back
      navigate(backUrl);
    }
  };

  const handlePrev = () => {
    if (isSingleMouseMode) {
      navigate(backUrl);
    } else if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // When editing a past day, go back to the day summary; otherwise go to cage detail
  const backUrl = isEditingPastDay
    ? `/experiment/${expId}/day/${observationDate}`
    : `/experiment/${expId}/cage/${cageNumber}`;

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  if (aliveMice.length === 0 || (isSingleMouseMode && singleMouseIndex === -1)) {
    return (
      <div className="text-center mt-12">
        <p className="text-gray-500">
          {isSingleMouseMode ? 'Mouse not found' : 'No alive mice in this cage'}
        </p>
        <Link to={backUrl} className="text-blue-600 mt-4 inline-block">
          Back to cage
        </Link>
      </div>
    );
  }

  if (!currentMouse) {
    return (
      <div className="text-center mt-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to={backUrl} className="text-blue-600">
          &larr; {isEditingPastDay ? formatDateShort(observationDate) : `Cage ${cageNumber}`}
        </Link>
        <div className="text-sm text-gray-500">
          {isEditingPastDay && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mr-2">
              Editing {formatDateShort(observationDate)}
            </span>
          )}
          {!isSingleMouseMode && (
            <span>{currentIndex + 1} of {aliveMice.length}</span>
          )}
        </div>
      </div>

      {/* Mouse Info Card */}
      <Card>
        <CardBody>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-2xl font-bold">{currentMouse.ear_tag}</div>
              <div className="text-sm text-gray-500">
                Cage {currentMouse.cage_number} &bull; {currentMouse.treatment_group_name}
              </div>
            </div>
            {existingObservation && (
              <span className="text-green-600 text-sm font-medium px-2 py-1 bg-green-50 rounded">
                ✓ {isEditingPastDay ? 'Has data' : 'Observed'}
              </span>
            )}
          </div>

          {/* Previous observation info */}
          {currentMouse.latest_observation && (
            <div className="mt-3 pt-3 border-t text-sm text-gray-600">
              <div>
                Last: {formatWeight(currentMouse.latest_observation.weight)}{' '}
                <span className={getWeightChangeClass(currentMouse.latest_observation.weight_pct_change)}>
                  ({formatPercentChange(currentMouse.latest_observation.weight_pct_change)})
                </span>
              </div>
              {currentMouse.latest_observation.total_css !== undefined && (
                <div>CSS: {currentMouse.latest_observation.total_css}</div>
              )}
            </div>
          )}

          {currentMouse.baseline_weight && (
            <div className="mt-2 text-xs text-gray-500">
              Baseline: {formatWeight(currentMouse.baseline_weight)}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-sm font-medium ${
                alert.severity === 'critical'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Success message */}
      {showSaveSuccess && (
        <div className="p-3 bg-green-100 text-green-800 rounded-lg text-center font-medium">
          Observation saved!
        </div>
      )}

      {/* Weight Input */}
      <Card>
        <CardBody>
          <WeightInput
            value={draft.weight}
            onChange={(weight) => setDraft({ ...draft, weight })}
            baselineWeight={currentMouse.baseline_weight || undefined}
            lastWeight={currentMouse.latest_observation?.weight || undefined}
          />
        </CardBody>
      </Card>

      {/* Scores - only show after baseline day */}
      {isBeforeBaseline ? (
        <Card>
          <CardBody>
            <div className="text-center py-4 text-gray-500">
              <div className="text-sm font-medium">Day {dayOfStudy} of Study</div>
              <div className="text-xs mt-1">
                CSS scoring begins on Day {experiment?.baseline_day_offset} (baseline)
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="space-y-4">
              <ScoreButtons
                type="stool"
                value={draft.stoolScore}
                onChange={(stoolScore) => setDraft({ ...draft, stoolScore })}
              />
              <ScoreButtons
                type="behavior"
                value={draft.behaviorScore}
                onChange={(behaviorScore) => setDraft({ ...draft, behaviorScore })}
              />
            </CardBody>
          </Card>

          {/* CSS Display */}
          <CssDisplay
            weightScore={weightScore}
            stoolScore={draft.stoolScore}
            behaviorScore={draft.behaviorScore}
            size="lg"
          />
        </>
      )}

      {/* Notes */}
      <Card>
        <CardBody>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            rows={2}
            placeholder="Optional notes..."
          />
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {isSingleMouseMode ? (
          <>
            <Button
              variant="secondary"
              onClick={() => navigate(backUrl)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createObservation.isPending}
              className="flex-1"
            >
              Save
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex-1"
            >
              Previous
            </Button>
            <Button
              onClick={handleSave}
              loading={createObservation.isPending}
              className="flex-1"
            >
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={handleNext}
              className="flex-1"
            >
              {currentIndex === aliveMice.length - 1 ? 'Done' : 'Next'}
            </Button>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex justify-center gap-4 pt-2">
        <Link
          to={`/experiment/${expId}/exit/${currentMouse.id}`}
          className="text-red-600 text-sm hover:underline"
        >
          Record death/sacrifice
        </Link>
      </div>
    </div>
  );
}
