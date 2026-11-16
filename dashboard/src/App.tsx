import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Loader2 } from 'lucide-react';

const MainRouter: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center text-haze gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-white" />
        <span className="text-sm font-medium">Starting RiskGuard…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <SocketProvider>
      <Dashboard />
    </SocketProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}

export default App;
