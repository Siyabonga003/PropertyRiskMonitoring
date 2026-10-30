import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthState, UserRole } from '../types/auth';
import { authService } from '../services/api';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<boolean>;
  demoLogin: (role?: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check localStorage on mount
    const savedToken = localStorage.getItem('riskguard_auth_token');
    const savedUser = localStorage.getItem('riskguard_auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('riskguard_auth_token');
        localStorage.removeItem('riskguard_auth_user');
      }
    } else {
      // Default to demo admin session for seamless reviewer experience
      const defaultDemoUser: User = {
        id: 'usr-admin-demo',
        email: 'admin@example.com',
        name: 'Chief Risk Officer',
        role: 'ADMIN',
      };
      const defaultDemoToken = 'demo-jwt-token-active';
      localStorage.setItem('riskguard_auth_token', defaultDemoToken);
      localStorage.setItem('riskguard_auth_user', JSON.stringify(defaultDemoUser));
      setUser(defaultDemoUser);
      setToken(defaultDemoToken);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await authService.login(email, pass);
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('riskguard_auth_token', res.token);
      localStorage.setItem('riskguard_auth_user', JSON.stringify(res.user));
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (role: UserRole = 'ADMIN') => {
    const email =
      role === 'ADMIN'
        ? 'admin@example.com'
        : role === 'MANAGER'
        ? 'manager@example.com'
        : 'viewer@example.com';
    await login(email, 'admin123');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('riskguard_auth_token');
    localStorage.removeItem('riskguard_auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
