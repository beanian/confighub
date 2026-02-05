import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { EnvironmentProvider } from './hooks/useEnvironment';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Browse } from './pages/Browse';
import { EditConfig } from './pages/EditConfig';
import { Changes } from './pages/Changes';
import { ChangeDetail } from './pages/ChangeDetail';
import { Compare } from './pages/Compare';
import { Promotions } from './pages/Promotions';
import { PromotionDetail } from './pages/PromotionDetail';
import { AuditLog } from './pages/AuditLog';
import { Drift } from './pages/Drift';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <EnvironmentProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse"
              element={
                <ProtectedRoute>
                  <Browse />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit/:env/:domain/:key"
              element={
                <ProtectedRoute>
                  <EditConfig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/changes"
              element={
                <ProtectedRoute>
                  <Changes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/changes/:id"
              element={
                <ProtectedRoute>
                  <ChangeDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compare"
              element={
                <ProtectedRoute>
                  <Compare />
                </ProtectedRoute>
              }
            />
            <Route
              path="/promotions"
              element={
                <ProtectedRoute>
                  <Promotions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/promotions/:id"
              element={
                <ProtectedRoute>
                  <PromotionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drift"
              element={
                <ProtectedRoute>
                  <Drift />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </EnvironmentProvider>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
