import { Link, useParams } from 'react-router-dom';
import { useCages, useExperiment } from '../hooks/useApi';
import { Card, CardBody } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function CageSelection() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const id = parseInt(experimentId || '0');

  const { data: experiment } = useExperiment(id);
  const { data: cages, isLoading } = useCages(id);

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  const aliveCages = cages?.filter(c => c.alive_count > 0) || [];
  const sortedCages = [...aliveCages].sort((a, b) => {
    // Sort incomplete cages first
    const aComplete = a.observed_today === a.alive_count;
    const bComplete = b.observed_today === b.alive_count;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return a.cage_number.localeCompare(b.cage_number);
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/experiment/${id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-xl font-bold mt-2">Select Cage</h1>
        <p className="text-gray-500">{experiment?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sortedCages.map((cage) => {
          const isDone = cage.observed_today === cage.alive_count;
          const progress = cage.alive_count > 0
            ? (cage.observed_today / cage.alive_count) * 100
            : 100;

          return (
            <Link
              key={cage.cage_number}
              to={`/experiment/${id}/cage/${cage.cage_number}`}
            >
              <Card
                className={`h-full transition-all active:scale-95 ${
                  isDone
                    ? 'bg-green-50 border-green-300'
                    : 'hover:border-blue-300'
                }`}
              >
                <CardBody>
                  <div className="flex justify-between items-start">
                    <div>
                      <div
                        className="text-2xl font-bold"
                        style={{ color: cage.treatment_group_color || undefined }}
                      >
                        {cage.cage_number}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {cage.treatment_group_name}
                      </div>
                      {cage.diet && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {cage.diet}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${isDone ? 'text-green-600' : ''}`}>
                        {cage.observed_today}/{cage.alive_count}
                      </div>
                      {isDone && (
                        <span className="text-green-600 text-xl">✓</span>
                      )}
                    </div>
                  </div>

                  <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isDone ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      {aliveCages.length === 0 && (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            No cages with alive mice found
          </CardBody>
        </Card>
      )}
    </div>
  );
}
