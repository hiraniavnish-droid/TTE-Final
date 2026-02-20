
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LeadProvider } from './contexts/LeadContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
const GroupTours = React.lazy(() => import('./pages/GroupTours').then(module => ({ default: module.GroupTours })));
const GroupTourDetails = React.lazy(() => import('./pages/GroupTourDetails').then(module => ({ default: module.GroupTourDetails })));
const DirectPackages = React.lazy(() => import('./pages/DirectPackages').then(module => ({ default: module.DirectPackages })));
const DirectPackageDetails = React.lazy(() => import('./pages/DirectPackageDetails').then(module => ({ default: module.DirectPackageDetails })));
const BlockedRates = React.lazy(() => import('./pages/BlockedRates').then(module => ({ default: module.BlockedRates })));

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
          <LeadProvider>
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
                      <Route path="group-tours" element={<GroupTours />} />
                      <Route path="group-tours/:id" element={<GroupTourDetails />} />
                      <Route path="direct-packages" element={<DirectPackages />} />
                      <Route path="direct-packages/:id" element={<DirectPackageDetails />} />
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
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
