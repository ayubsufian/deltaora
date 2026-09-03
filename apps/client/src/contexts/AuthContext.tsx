import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../lib/axios';
import { startAuthentication } from '@simplewebauthn/browser';

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
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string, recoveryCode?: string) => Promise<void>;
  passkeyLogin: (email: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<{ message?: string } | void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
        const res = await api.post('/auth/refresh');
        setUser(res.data.user);

        const savedWorkspace = localStorage.getItem('activeWorkspaceId');
        if (savedWorkspace) {
          api.defaults.headers.common['x-workspace-id'] = savedWorkspace;
        }
      } catch {
        localStorage.removeItem('activeWorkspaceId');
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
    const { user: userData, defaultWorkspaceId } = res.data;
    setUser(userData);

    if (defaultWorkspaceId || res.data.workspaceId) {
      setActiveWorkspaceId(defaultWorkspaceId || res.data.workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const passkeyLogin = useCallback(async (email: string) => {
    const optionsRes = await api.post('/auth/passkeys/authenticate/options', { email }, { withCredentials: true });
    const credential = await startAuthentication({ optionsJSON: optionsRes.data } as any);
    const res = await api.post('/auth/passkeys/authenticate/verify', { credential }, { withCredentials: true });
    const { user: userData, defaultWorkspaceId } = res.data;
    setUser(userData);

    if (defaultWorkspaceId || res.data.workspaceId) {
      setActiveWorkspaceId(defaultWorkspaceId || res.data.workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const register = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    const res = await api.post('/auth/register', { name, email, password, confirmPassword }, { withCredentials: true });
    const { user: userData, workspaceId } = res.data;
    if (!userData) {
      return { message: res.data.message };
    }
    setUser(userData);

    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [setActiveWorkspaceId]);

  const googleLogin = useCallback(async (tokenStr: string) => {
    const res = await api.post('/auth/google', { token: tokenStr }, { withCredentials: true });
    const { user: userData, workspaceId } = res.data;
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
    localStorage.removeItem('activeWorkspaceId');
    delete api.defaults.headers.common['x-workspace-id'];
    setUser(null);
    setActiveWorkspaceIdState(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      activeWorkspaceId,
      setActiveWorkspaceId,
      isAuthenticated: !!user,
      isLoading,
      login,
      passkeyLogin,
      googleLogin,
      register,
      logout,
      updateUser,
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
