import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import EquipmentPage from './pages/EquipmentPage';
import FinancialPage from './pages/FinancialPage';
import SchedulingPage from './pages/SchedulingPage';

function App() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  // Show loading while checking auth status
  if (authStatus === 'configuring') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const ProtectedRoute = ({ element }: { element: React.ReactElement }) => {
    return authStatus === 'authenticated' ? element : <Navigate to="/login" replace />;
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authStatus === 'authenticated' ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/dashboard" element={<ProtectedRoute element={<DashboardPage />} />} />
      <Route path="/customers" element={<ProtectedRoute element={<CustomersPage />} />} />
      <Route path="/work-orders" element={<ProtectedRoute element={<WorkOrdersPage />} />} />
      <Route path="/equipment" element={<ProtectedRoute element={<EquipmentPage />} />} />
      <Route path="/financial" element={<ProtectedRoute element={<FinancialPage />} />} />
      <Route path="/scheduling" element={<ProtectedRoute element={<SchedulingPage />} />} />
      <Route
        path="/"
        element={
          authStatus === 'authenticated' ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
