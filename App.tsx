
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { LeadProvider } from './contexts/LeadContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaskProvider } from './contexts/TaskContext';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui/PageLoader';

// --- LAZY LOADED PAGES ---
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Leads = React.lazy(() => import('./pages/Leads').then(module => ({ default: module.Leads })));
const LeadDetails = React.lazy(() => import('./pages/LeadDetails').then(module => ({ default: module.LeadDetails })));
const Reminders = React.lazy(() => import('./pages/Reminders').then(module => ({ default: module.Reminders })));
const Customers = React.lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const Suppliers = React.lazy(() => import('./pages/Suppliers').then(module => ({ default: module.Suppliers })));
const TeamSettings = React.lazy(() => import('./pages/TeamSettings').then(module => ({ default: module.TeamSettings })));
const Login = React.lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const KutchItineraryBuilder = React.lazy(() => import('./components/KutchItineraryBuilder').then(module => ({ default: module.KutchItineraryBuilder })));
const BlockedRates = React.lazy(() => import('./pages/BlockedRates').then(module => ({ default: module.BlockedRates })));
const RannUtsavBuilder = React.lazy(() => import('./pages/RannUtsavBuilder').then(module => ({ default: module.RannUtsavBuilder })));
const SouTentCityBuilder = React.lazy(() => import('./pages/SouTentCityBuilder').then(module => ({ default: module.SouTentCityBuilder })));
const RajarshiBuilder = React.lazy(() => import('./pages/RajarshiBuilder').then(module => ({ default: module.RajarshiBuilder })));
const InlandBuilder = React.lazy(() => import('./pages/InlandBuilder').then(module => ({ default: module.InlandBuilder })));
const Payments = React.lazy(() => import('./pages/Payments').then(module => ({ default: module.Payments })));

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <TaskProvider>
          <LeadProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3500,
                style: { borderRadius: '12px', fontSize: '13px', fontWeight: 600 },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
            <HashRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="leads" element={<Leads />} />
                      <Route path="leads/:id" element={<LeadDetails />} />
                      <Route path="builder" element={<KutchItineraryBuilder />} />
                      <Route path="rann-utsav-builder" element={<RannUtsavBuilder />} />
                      <Route path="sou-tent-city-builder" element={<SouTentCityBuilder />} />
                      <Route path="rajarshi-builder" element={<RajarshiBuilder />} />
                      <Route path="inland-builder" element={<InlandBuilder />} />
                      <Route path="payments" element={<Payments />} />
                      <Route path="blocked-rates" element={<BlockedRates />} />
                      <Route path="suppliers" element={<Suppliers />} />
                      <Route path="customers" element={<Customers />} />
                      <Route path="reminders" element={<Reminders />} />
                      <Route path="team-settings" element={<TeamSettings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </HashRouter>
          </LeadProvider>
          </TaskProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
