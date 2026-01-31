import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useExperiment, useCages, useObservationsSummary, useObservationAlerts, useDeleteExperiment } from '../hooks/useApi';
import { SyncForOffline } from '../components/SyncForOffline';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { formatDate, formatDateShort, formatPercentChange, getCssSeverityClass } from '../utils/formatting';
import { useAppContext } from '../context/AppContext';

export function ExperimentDashboard() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const id = parseInt(experimentId || '0');
  const { isMobile } = useAppContext();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteExperiment = useDeleteExperiment();

  const { data: experiment, isLoading: loadingExp } = useExperiment(id);
  const { data: cages, isLoading: loadingCages } = useCages(id);
  const { data: summary } = useObservationsSummary(id);
  const { data: alerts } = useObservationAlerts(id);

  if (loadingExp || loadingCages) {
    return <LoadingSpinner className="mt-12" />;
  }

  if (!experiment) {
    return (
      <div className="text-center mt-12">
        <p className="text-gray-500">Experiment not found</p>
      </div>
    );
  }

  const aliveCages = cages?.filter(c => c.alive_count > 0) || [];
  const totalAlive = aliveCages.reduce((sum, c) => sum + c.alive_count, 0);
  const totalObserved = aliveCages.reduce((sum, c) => sum + c.observed_today, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          &larr; Back to experiments
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">{experiment.name}</h1>
            <p className="text-gray-500">
              Started {formatDate(experiment.start_date)} &bull;{' '}
              {totalAlive} mice alive
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncForOffline experimentId={id} />
            <Link to={`/experiment/${id}/edit`}>
              <Button variant="secondary" size="sm">Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to={`/experiment/${id}/cages`}>
          <Button size={isMobile ? 'lg' : 'md'}>
            Start Daily Check-in
          </Button>
        </Link>
        <Link to={`/experiment/${id}/batch`}>
          <Button variant="secondary">Batch Entry</Button>
        </Link>
        <Link to={`/experiment/${id}/samples`}>
          <Button variant="secondary">Collect Samples</Button>
        </Link>
        <Link to={`/experiment/${id}/samples/list`}>
          <Button variant="secondary">View Samples</Button>
        </Link>
      </div>

      {/* Today's Progress */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Today's Progress</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: totalAlive > 0
                      ? `${(totalObserved / totalAlive) * 100}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
            <div className="text-right font-medium">
              {totalObserved} / {totalAlive}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Active Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <h2 className="font-semibold text-red-700">Active Alerts ({alerts.length})</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                to={`/experiment/${id}/cage/${alert.cage_number}/mouse/${alert.subject_id}`}
                className="block"
              >
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold">{alert.ear_tag}</div>
                    <div className="text-sm text-gray-500">Cage {alert.cage_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3">
                      {alert.weight_pct_change !== null && alert.weight_pct_change !== undefined && (
                        <span className={`text-sm font-medium ${alert.weight_pct_change <= -15 ? 'text-red-700' : 'text-orange-600'}`}>
                          {formatPercentChange(alert.weight_pct_change)}
                        </span>
                      )}
                      {alert.total_css !== null && alert.total_css !== undefined && (
                        <span className={`text-sm font-medium ${getCssSeverityClass(alert.total_css)}`}>
                          CSS: {alert.total_css}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      {alert.alert_reasons.join(' | ')}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Cages Overview */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Cages</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {aliveCages.map((cage) => {
            const progress = cage.alive_count > 0
              ? (cage.observed_today / cage.alive_count) * 100
              : 100;
            const isDone = cage.observed_today === cage.alive_count;

            return (
              <Link
                key={cage.cage_number}
                to={`/experiment/${id}/cage/${cage.cage_number}`}
              >
                <Card
                  className={`h-full ${isDone ? 'bg-green-50 border-green-200' : ''}`}
                >
                  <CardBody className="text-center">
                    <div
                      className="text-lg font-bold"
                      style={{ color: cage.treatment_group_color || undefined }}
                    >
                      {cage.cage_number}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {cage.treatment_group_name}
                    </div>
                    <div className="text-xs mt-2">
                      {cage.observed_today}/{cage.alive_count}
                    </div>
                    <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full ${isDone ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Treatment Groups */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Treatment Groups</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {experiment.treatment_groups.map((group) => {
            const groupCages = cages?.filter(c => c.treatment_group_id === group.id) || [];
            const groupAlive = groupCages.reduce((sum, c) => sum + c.alive_count, 0);
            const groupTotal = groupCages.reduce((sum, c) => sum + c.total_count, 0);

            return (
              <Card key={group.id}>
                <CardBody>
                  <div className="flex items-center gap-3">
                    {group.color && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{group.name}</div>
                      {group.description && (
                        <div className="text-sm text-gray-500">{group.description}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{groupAlive}</div>
                      <div className="text-xs text-gray-500">/ {groupTotal}</div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Study Days */}
      {summary && summary.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Study Days</h2>
            <span className="text-sm text-gray-500">{summary.length} days</span>
          </div>
          <Card>
            <div className="divide-y max-h-96 overflow-y-auto">
              {summary.map((day) => (
                <Link
                  key={day.date}
                  to={`/experiment/${id}/day/${day.date}`}
                  className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                    day.timepoint_name ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[3rem]">
                        <div className="text-lg font-bold text-gray-700">D{day.day_of_study}</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatDateShort(day.date)}</div>
                        <div className="text-xs text-gray-500">
                          {day.observed_count}/{day.total_subjects} observed
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.timepoint_name && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                          {day.timepoint_name}
                        </span>
                      )}
                      {day.samples_collected > 0 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                          {day.samples_collected} samples
                        </span>
                      )}
                      {day.alerts_count > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                          {day.alerts_count} alerts
                        </span>
                      )}
                      <span className="text-gray-400">&rarr;</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Danger Zone */}
      <section className="pt-6 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-red-600 mb-3">Danger Zone</h2>
        {!showDeleteConfirm ? (
          <Button
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Experiment
          </Button>
        ) : (
          <Card className="border-red-300 bg-red-50">
            <CardBody>
              <p className="text-red-800 mb-4">
                Are you sure you want to delete <strong>{experiment.name}</strong>?
                <br />
                <span className="text-sm">
                  This will permanently delete all {totalAlive + (cages?.reduce((sum, c) => sum + c.total_count - c.alive_count, 0) || 0)} mice,
                  observations, and samples. This cannot be undone.
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={deleteExperiment.isPending}
                  onClick={async () => {
                    await deleteExperiment.mutateAsync(id);
                    navigate('/');
                  }}
                >
                  Yes, Delete Everything
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
