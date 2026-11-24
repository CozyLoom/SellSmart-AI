import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { BusinessProfile, BusinessSettings, UserProfile } from '../types';
import { apiRequest, setMemoryToken } from '../services/api';

interface AuthContextValue {
  user: UserProfile | null;
  business: BusinessProfile | null;
  settings: BusinessSettings | null;
  loading: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  refreshSession: () => Promise<void>;
  applyAuthResponse: (data: { token?: string; user: UserProfile; business: BusinessProfile | null }) => void;
  setBusiness: React.Dispatch<React.SetStateAction<BusinessProfile | null>>;
  setSettings: React.Dispatch<React.SetStateAction<BusinessSettings | null>>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  const applyThemeClass = useCallback((next: 'dark' | 'light') => {
    const root = document.documentElement;
    if (next === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  const setTheme = useCallback(
    (next: 'dark' | 'light') => {
      setThemeState(next);
      applyThemeClass(next);
    },
    [applyThemeClass]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<{
        user: UserProfile;
        business: BusinessProfile | null;
        settings: BusinessSettings | null;
      }>('/api/auth/me');
      setUser(data.user);
      setBusiness(data.business);
      setSettings(data.settings);
      if (data.settings?.themePreference) {
        setTheme(data.settings.themePreference);
      }
    } catch {
      setUser(null);
      setBusiness(null);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  useEffect(() => {
    applyThemeClass('dark');
    void refreshSession();
  }, [applyThemeClass, refreshSession]);

  const applyAuthResponse = useCallback(
    (data: { token?: string; user: UserProfile; business: BusinessProfile | null }) => {
      if (data.token) {
        setMemoryToken(data.token);
      }
      setUser(data.user);
      setBusiness(data.business);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setMemoryToken(null);
    setUser(null);
    setBusiness(null);
    setSettings(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        settings,
        loading,
        theme,
        toggleTheme,
        setTheme,
        refreshSession,
        applyAuthResponse,
        setBusiness,
        setSettings,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
