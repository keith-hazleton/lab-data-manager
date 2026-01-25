import { Link } from 'react-router-dom';
import { useExperiments } from '../hooks/useApi';
import { Card, CardBody } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatting';

export function Home() {
  const { data: experiments, isLoading, error } = useExperiments();

  if (isLoading) {
    return <LoadingSpinner className="mt-12" />;
  }

  if (error) {
    return (
      <div className="text-center mt-12">
        <p className="text-red-600">Failed to load experiments</p>
      </div>
    );
  }

  const activeExperiments = experiments?.filter(e => e.status === 'active') || [];
  const completedExperiments = experiments?.filter(e => e.status !== 'active') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiments</h1>
        <Link to="/experiment/new">
          <Button>+ New Experiment</Button>
        </Link>
      </div>

      {/* Active Experiments */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Active</h2>
        {activeExperiments.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-gray-500 text-center py-4">
                No active experiments. Create one to get started.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeExperiments.map((exp) => (
              <Link key={exp.id} to={`/experiment/${exp.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardBody>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{exp.name}</h3>
                        <p className="text-sm text-gray-500">
                          Started {formatDate(exp.start_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="font-medium">{exp.alive_mice}</span>
                          <span className="text-gray-500">/{exp.total_mice} mice</span>
                        </div>
                        {exp.pending_today > 0 && (
                          <div className="text-sm text-orange-600 font-medium">
                            {exp.pending_today} pending today
                          </div>
                        )}
                        {exp.pending_today === 0 && exp.completed_today > 0 && (
                          <div className="text-sm text-green-600 font-medium">
                            All done today
                          </div>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Completed Experiments */}
      {completedExperiments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Completed & Archived</h2>
          <div className="space-y-2">
            {completedExperiments.map((exp) => (
              <Link key={exp.id} to={`/experiment/${exp.id}`}>
                <Card className="opacity-75 hover:opacity-100 transition-opacity">
                  <CardBody className="py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{exp.name}</h3>
                        <p className="text-xs text-gray-500">
                          {formatDate(exp.start_date)} - {exp.end_date ? formatDate(exp.end_date) : 'ongoing'}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {exp.status}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
