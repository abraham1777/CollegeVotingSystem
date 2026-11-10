"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  AuthUser,
  getAdminToken,
  setAdminToken,
  removeAdminToken,
  getStudentToken,
  removeStudentToken,
  loginAdminUser,
  loginStudentUser,
  fetchCurrentUser,
  isTokenExpired,
} from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginStudent: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  clearSessionExpiredBanner: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Initial session restoration on client mount
  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      const storedToken = getAdminToken() || getStudentToken();

      if (!storedToken) {
        if (!ignore) {
          setIsLoading(false);
        }
        return;
      }

      if (isTokenExpired(storedToken)) {
        removeAdminToken();
        removeStudentToken();
        if (!ignore) {
          setSessionExpired(true);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await fetchCurrentUser(storedToken);
        if (!ignore) {
          setUser(profile);
          setToken(storedToken);
          setSessionExpired(false);
        }
      } catch {
        if (!ignore) {
          removeAdminToken();
          removeStudentToken();
          setUser(null);
          setToken(null);
          setSessionExpired(true);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      ignore = true;
    };
  }, []);

  // Periodic expiration monitor (guards against 30-minute access token expiry)
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        removeAdminToken();
        removeStudentToken();
        setUser(null);
        setToken(null);
        setSessionExpired(true);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setSessionExpired(false);
    try {
      const result = await loginAdminUser(email, password);
      setAdminToken(result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginStudent = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setSessionExpired(false);
    try {
      const result = await loginStudentUser(email, password);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeAdminToken();
    removeStudentToken();
    setUser(null);
    setToken(null);
    setSessionExpired(false);
  }, []);

  const clearSessionExpiredBanner = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const isAuthenticated = !!user && !!token;
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        isStudent,
        sessionExpired,
        login,
        loginStudent,
        logout,
        clearSessionExpiredBanner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
