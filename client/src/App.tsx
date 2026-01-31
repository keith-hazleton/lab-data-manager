import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { ExperimentDashboard } from './pages/ExperimentDashboard';
import { ExperimentEdit } from './pages/ExperimentEdit';
import { CageSelection } from './pages/CageSelection';
import { CageDetail } from './pages/CageDetail';
import { MouseEntry } from './pages/MouseEntry';
import { BatchEntry } from './pages/BatchEntry';
import { DeathSacrifice } from './pages/DeathSacrifice';
import { SampleCollection } from './pages/SampleCollection';
import { SamplesList } from './pages/SamplesList';
import { SampleStorage } from './pages/SampleStorage';
import { GlobalSamplesBrowser } from './pages/GlobalSamplesBrowser';
import { Plots } from './pages/Plots';
import { ExperimentSetup } from './pages/setup/ExperimentSetup';
import { DaySummary } from './pages/DaySummary';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experiment/new" element={<ExperimentSetup />} />
        <Route path="/experiment/:experimentId" element={<ExperimentDashboard />} />
        <Route path="/experiment/:experimentId/edit" element={<ExperimentEdit />} />
        <Route path="/experiment/:experimentId/day/:date" element={<DaySummary />} />
        <Route path="/experiment/:experimentId/cages" element={<CageSelection />} />
        <Route path="/experiment/:experimentId/cage/:cageNumber" element={<CageDetail />} />
        <Route path="/experiment/:experimentId/cage/:cageNumber/entry" element={<MouseEntry />} />
        <Route path="/experiment/:experimentId/cage/:cageNumber/mouse/:mouseId" element={<MouseEntry />} />
        <Route path="/experiment/:experimentId/batch" element={<BatchEntry />} />
        <Route path="/experiment/:experimentId/exit/:subjectId" element={<DeathSacrifice />} />
        <Route path="/experiment/:experimentId/samples" element={<SampleCollection />} />
        <Route path="/experiment/:experimentId/samples/list" element={<SamplesList />} />
        <Route path="/storage" element={<SampleStorage />} />
        <Route path="/samples" element={<GlobalSamplesBrowser />} />
        <Route path="/plots" element={<Plots />} />
      </Routes>
      <OfflineIndicator />
    </Layout>
  );
}
