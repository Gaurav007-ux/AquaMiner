/* ============================================================
   AquaYantra — Main Application Router & Shell
   Command-center routing structure & TanStack Query Provider
   ============================================================ */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './layout/AppShell';

import { OverviewPage } from './pages/Overview';
import { LiveMonitoringPage } from './pages/LiveMonitoring';
import { SeabedMapPage } from './pages/SeabedMap';
import { DetectionAnalyticsPage } from './pages/DetectionAnalytics';
import { MissionsPage } from './pages/Missions';
import { SensorDataPage } from './pages/SensorData';
import { CalibrationPage } from './pages/Calibration';
import { MLIntelligencePage } from './pages/MLIntelligence';
import { SystemHealthPage } from './pages/SystemHealth';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { LoginPage } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30s
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Command Center Shell */}
          <Route element={<AppShell />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/live" element={<LiveMonitoringPage />} />
            <Route path="/map" element={<SeabedMapPage />} />
            <Route path="/detections" element={<DetectionAnalyticsPage />} />
            <Route path="/missions" element={<MissionsPage />} />
            <Route path="/sensors" element={<SensorDataPage />} />
            <Route path="/calibration" element={<CalibrationPage />} />
            <Route path="/ml" element={<MLIntelligencePage />} />
            <Route path="/health" element={<SystemHealthPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
