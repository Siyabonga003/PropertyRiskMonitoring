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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        <span className="text-sm font-medium">Initializing RiskGuard Mission Control...</span>
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
