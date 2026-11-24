import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../api/auth.js';
import { setSessionExpiredHandler } from '../api/client.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const userRef = useRef(null);
  const { showToast } = useToast();

  const updateUser = useCallback((nextUser) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  // On first load: make sure a CSRF cookie exists, then ask who we are.
  // A 401 here just means "not logged in".
  useEffect(() => {
    let cancelled = false;
    authApi
      .ensureCsrfToken()
      .then(authApi.fetchCurrentUser)
      .then((current) => !cancelled && updateUser(current))
      .catch(() => !cancelled && updateUser(null))
      .finally(() => !cancelled && setIsReady(true));
    return () => {
      cancelled = true;
    };
  }, [updateUser]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (userRef.current) showToast({ type: 'error', message: 'Your session expired. Please log in again.' });
      updateUser(null);
    });
  }, [showToast, updateUser]);

  const login = useCallback(
    async (credentials) => {
      const loggedIn = await authApi.login(credentials);
      updateUser(loggedIn);
      return loggedIn;
    },
    [updateUser],
  );

  const register = useCallback(
    async (details) => {
      const registered = await authApi.register(details);
      updateUser(registered);
      return registered;
    },
    [updateUser],
  );
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      updateUser(null);
    }
  }, [updateUser]);

  const value = useMemo(
    () => ({ user, isReady, login, register, logout, setUser: updateUser }),
    [user, isReady, login, register, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
