import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider } from './context/DataContext';
import { TourProvider } from './context/TourContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Requisiciones from './pages/Requisiciones';
import Comparativo from './pages/Comparativo';
import CapturaMovil from './pages/CapturaMovil';
import Admin from './pages/Admin';

function AppRoutes() {
  const { session, isLoading, isSuperadmin } = useAuth();

  if (isLoading) {
    return (
      <div id="ca-app" style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div id="ca-app">
        <Login />
      </div>
    );
  }

  return (
    <DataProvider>
      <TourProvider>
        <div id="ca-app" style={{ minHeight: '100vh', background: 'var(--canvas)', display: 'flex', flexDirection: 'column' }}>
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/requisiciones" element={<Requisiciones />} />
              <Route path="/comparativo" element={<Comparativo />} />
              {isSuperadmin && <Route path="/admin" element={<Admin />} />}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        </div>
      </TourProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta móvil de captura: sin login, sin nav — session_id del QR es el único control de acceso */}
          <Route path="/captura-movil/:sessionId" element={<CapturaMovil />} />
          <Route
            path="*"
            element={
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
