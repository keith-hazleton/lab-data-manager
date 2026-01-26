import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useExperiments } from '../hooks/useApi';
import { Card, CardBody } from '../components/common/Card';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatting';

function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function Home() {
  const { data: experiments, isLoading, error } = useExperiments();
  const [exporting, setExporting] = useState<number | 'all' | null>(null);

  const handleExportAll = async () => {
    setExporting('all');
    try {
      downloadFile('/api/export/all', 'lab-data-export.zip');
    } finally {
      // Small delay to show feedback
      setTimeout(() => setExporting(null), 1000);
    }
  };

  const handleExportExperiment = async (experimentId: number, experimentName: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    setExporting(experimentId);
    try {
      // Export observations and samples for this experiment
      const safeName = experimentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadFile(`/api/export/observations?experiment_id=${experimentId}`, `${safeName}_observations.csv`);
      // Small delay between downloads
      setTimeout(() => {
        downloadFile(`/api/export/samples?experiment_id=${experimentId}`, `${safeName}_samples.csv`);
      }, 500);
    } finally {
      setTimeout(() => setExporting(null), 1500);
    }
  };

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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleExportAll}
            disabled={exporting === 'all'}
          >
            {exporting === 'all' ? 'Exporting...' : 'Export All'}
          </Button>
          <Link to="/experiment/new">
            <Button>+ New Experiment</Button>
          </Link>
        </div>
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
                      <div className="text-right flex items-start gap-2">
                        <div>
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
                        <button
                          onClick={(e) => handleExportExperiment(exp.id, exp.name, e)}
                          disabled={exporting === exp.id}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          title="Export experiment data"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                          {exp.status}
                        </span>
                        <button
                          onClick={(e) => handleExportExperiment(exp.id, exp.name, e)}
                          disabled={exporting === exp.id}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          title="Export experiment data"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
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
