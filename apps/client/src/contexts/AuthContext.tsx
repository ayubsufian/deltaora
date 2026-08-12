import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled?: boolean;
  isEmailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string, recoveryCode?: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('accessToken'));
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => localStorage.getItem('activeWorkspaceId'));
  const [isLoading, setIsLoading] = useState(true);

  const setActiveWorkspaceId = useCallback((id: string) => {
    localStorage.setItem('activeWorkspaceId', id);
    setActiveWorkspaceIdState(id);
    api.defaults.headers.common['x-workspace-id'] = id;
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        const res = await api.post('/auth/refresh', {}, { withCredentials: true });
        const newToken = res.data.accessToken;
        sessionStorage.setItem('accessToken', newToken);
        setToken(newToken);
        setUser(res.data.user);

        const savedWorkspace = localStorage.getItem('activeWorkspaceId');
        if (savedWorkspace) {
          api.defaults.headers.common['x-workspace-id'] = savedWorkspace;
        }
      } catch {
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('activeWorkspaceId');
        setToken(null);
        setUser(null);
        setActiveWorkspaceIdState(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = useCallback(async (email: string, password: string, mfaCode?: string, recoveryCode?: string) => {
    const res = await api.post('/auth/login', { email, password, mfaCode, recoveryCode }, { withCredentials: true });
    const { accessToken, user: userData, defaultWorkspaceId } = res.data;
    sessionStorage.setItem('accessToken', accessToken);
    setToken(accessToken);
    setUser(userData);

    if (defaultWorkspaceId || res.data.workspaceId) {
      setActiveWorkspaceId(defaultWorkspaceId || res.data.workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const register = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const res = await api.post('/auth/register', { name, email, password, confirmPassword }, { withCredentials: true });
    const { accessToken, user: userData, workspaceId } = res.data;
    sessionStorage.setItem('accessToken', accessToken);
    setToken(accessToken);
    setUser(userData);

    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const googleLogin = useCallback(async (tokenStr: string) => {
    const res = await api.post('/auth/google', { token: tokenStr }, { withCredentials: true });
    const { accessToken, user: userData, workspaceId } = res.data;
    sessionStorage.setItem('accessToken', accessToken);
    setToken(accessToken);
    setUser(userData);

    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch {
      // Ignore logout transport errors and clear local state anyway.
    }
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('activeWorkspaceId');
    delete api.defaults.headers.common['x-workspace-id'];
    setToken(null);
    setUser(null);
    setActiveWorkspaceIdState(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      activeWorkspaceId,
      setActiveWorkspaceId,
      isAuthenticated: !!user,
      isLoading,
      login,
      googleLogin,
      register,
      logout,
    }}>
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
