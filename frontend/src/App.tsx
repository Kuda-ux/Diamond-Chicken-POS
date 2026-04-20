import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import KitchenPage from './pages/KitchenPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        user?.role === 'cashier' ? <Navigate to="/pos" replace /> :
        user?.role === 'kitchen' ? <Navigate to="/kitchen" replace /> :
        <Navigate to="/dashboard" replace />
      } />
      <Route path="/pos" element={<POSPage />} />
      <Route path="/kitchen" element={<KitchenPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
