import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore session via refresh token
  useEffect(() => {
    const restore = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        setToken(savedToken);
        try {
          // Try a refresh to validate the session and get user data
          const res = await api.post('/auth/refresh', {}, { withCredentials: true });
          const newToken = res.data.accessToken;
          localStorage.setItem('token', newToken);
          setToken(newToken);
          // Decode user from token (JWT payload is the second segment)
          const payload = JSON.parse(atob(newToken.split('.')[1]));
          setUser({ id: payload.userId, name: payload.name || '', email: payload.email || '', role: payload.role || 'user' });
        } catch {
          // Refresh failed — clear state
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password }, { withCredentials: true });
    const { accessToken, user: userData } = res.data;
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(userData);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const res = await api.post('/auth/register', { name, email, password, confirmPassword }, { withCredentials: true });
    const { accessToken, user: userData } = res.data;
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch {
      // Ignore errors during logout
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
