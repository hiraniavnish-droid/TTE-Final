
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
const SouHotelsBuilder = React.lazy(() => import('./pages/SouHotelsBuilder').then(module => ({ default: module.SouHotelsBuilder })));
const RajarshiBuilder = React.lazy(() => import('./pages/RajarshiBuilder').then(module => ({ default: module.RajarshiBuilder })));
const InlandBuilder = React.lazy(() => import('./pages/InlandBuilder').then(module => ({ default: module.InlandBuilder })));
const Payments = React.lazy(() => import('./pages/Payments').then(module => ({ default: module.Payments })));
const QuoteTrainerPractice = React.lazy(() => import('./pages/QuoteTrainerPractice').then(module => ({ default: module.QuoteTrainerPractice })));

const Availability = React.lazy(() => import('./pages/Availability').then(module => ({ default: module.Availability })));
const RajarshiHub = React.lazy(() => import('./pages/RajarshiHub').then(module => ({ default: module.RajarshiHub })));
const RajarshiReadyPackages = React.lazy(() => import('./pages/RajarshiReadyPackages').then(module => ({ default: module.RajarshiReadyPackages })));
const Attendance = React.lazy(() => import('./pages/Attendance').then(module => ({ default: module.Attendance })));

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  declare readonly props: { children: React.ReactNode };
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('CRM page failed to render:', error); }
  render() {
    if (this.state.failed) return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-50 text-slate-800">
      <h1 className="text-xl font-bold">This page could not load</h1>
      <p>Reload to get the latest CRM version. Your saved data is safe.</p>
      <button className="rounded-lg bg-blue-600 px-5 py-3 text-white" onClick={() => window.location.reload()}>Reload CRM</button>
    </div>;
    return this.props.children;
  }
}

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
                      <Route path="sou-hotels-builder" element={<SouHotelsBuilder />} />
                      <Route path="rajarshi-builder" element={<RajarshiHub />} />
                      <Route path="rajarshi-builder/hotels" element={<RajarshiBuilder />} />
                      <Route path="rajarshi-builder/packages" element={<RajarshiReadyPackages />} />
                      <Route path="inland-builder" element={<InlandBuilder />} />
                      <Route path="availability" element={<Availability />} />
                      <Route path="attendance" element={<Attendance />} />
                      <Route path="payments" element={<Payments />} />
                      <Route path="blocked-rates" element={<BlockedRates />} />
                      <Route path="suppliers" element={<Suppliers />} />
                      <Route path="customers" element={<Customers />} />
                      <Route path="reminders" element={<Reminders />} />
                      <Route path="team-settings" element={<TeamSettings />} />
                      <Route path="quote-trainer" element={<QuoteTrainerPractice />} />
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
