import { Link, useParams } from 'react-router-dom';
import { useExperiment, useSubjects, useObservationAlerts } from '../hooks/useApi';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { formatDate, formatWeight, formatPercentChange, getWeightChangeClass, getCssSeverityClass } from '../utils/formatting';

export function DaySummary() {
  const { experimentId, date } = useParams<{ experimentId: string; date: string }>();
  const expId = parseInt(experimentId || '0');

  const { data: experiment } = useExperiment(expId);
  // Get all subjects that were alive on this date, with observations for that date
  const { data: subjects, isLoading } = useSubjects(expId, { alive_on_date: date, observation_date: date });
  const { data: alerts } = useObservationAlerts(expId, date);

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  // Group subjects by cage
  const byCage = new Map<string, typeof subjects>();
  for (const subject of subjects || []) {
    const cage = subject.cage_number;
    if (!byCage.has(cage)) {
      byCage.set(cage, []);
    }
    byCage.get(cage)!.push(subject);
  }

  const sortedCages = Array.from(byCage.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const alertIds = new Set(alerts?.map(a => a.subject_id) || []);
  const observedCount = subjects?.filter(s => s.latest_observation).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={`/experiment/${expId}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">{formatDate(date || '')}</h1>
        <p className="text-gray-500">{experiment?.name}</p>
        <p className="text-sm text-gray-600 mt-1">
          {observedCount} of {subjects?.length || 0} mice observed
          {alerts && alerts.length > 0 && (
            <span className="text-red-600 ml-2">({alerts.length} with alerts)</span>
          )}
        </p>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <h2 className="font-semibold text-red-700">Alerts on this day</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                to={`/experiment/${expId}/cage/${alert.cage_number}/mouse/${alert.subject_id}?date=${date}`}
                className="block"
              >
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold">{alert.ear_tag}</div>
                    <div className="text-sm text-gray-500">Cage {alert.cage_number}</div>
                  </div>
                  <div className="text-right text-sm">
                    {alert.alert_reasons.map((reason, i) => (
                      <div key={i} className="text-red-600">{reason}</div>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Subjects by Cage */}
      {sortedCages.map(([cageNumber, cageSubjects]) => (
        <section key={cageNumber}>
          <h2 className="text-lg font-semibold mb-3">
            Cage {cageNumber}
            <span className="text-sm font-normal text-gray-500 ml-2">
              {cageSubjects![0].treatment_group_name}
            </span>
          </h2>
          <Card>
            <div className="divide-y">
              {cageSubjects!.sort((a, b) => a.ear_tag.localeCompare(b.ear_tag)).map((subject) => {
                const hasAlert = alertIds.has(subject.id);
                const obs = subject.latest_observation;
                const hasObservation = !!obs;
                return (
                  <Link
                    key={subject.id}
                    to={`/experiment/${expId}/cage/${cageNumber}/mouse/${subject.id}?date=${date}`}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${hasAlert ? 'bg-red-50' : !hasObservation ? 'bg-yellow-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-bold">{subject.ear_tag}</div>
                        {hasAlert && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Alert</span>
                        )}
                        {!hasObservation && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">No data</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {hasObservation ? (
                          <>
                            <div>
                              <span className="text-gray-500">Weight:</span>{' '}
                              <span className="font-medium">{formatWeight(obs.weight)}</span>
                              {obs.weight_pct_change !== null && obs.weight_pct_change !== undefined && (
                                <span className={`ml-1 ${getWeightChangeClass(obs.weight_pct_change)}`}>
                                  ({formatPercentChange(obs.weight_pct_change)})
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500">CSS:</span>{' '}
                              <span className={`font-medium ${getCssSeverityClass(obs.total_css)}`}>
                                {obs.total_css ?? '-'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">Click to add observation</span>
                        )}
                        <span className="text-gray-400">&rarr;</span>
                      </div>
                    </div>
                    {obs?.notes && (
                      <div className="text-xs text-gray-500 mt-1 truncate">{obs.notes}</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
      ))}

      {(!subjects || subjects.length === 0) && (
        <Card>
          <CardBody className="text-center text-gray-500 py-8">
            No mice were alive on this day
          </CardBody>
        </Card>
      )}
    </div>
  );
}
