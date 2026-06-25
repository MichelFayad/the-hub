import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken, ApiError } from "../api/client";
import type { AuthResponse, AuthUser } from "../api/types";

const TOKEN_KEY = "the-hub-mobile-token";
const USER_KEY = "the-hub-mobile-user";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(auth: AuthResponse): Promise<void> {
  setAuthToken(auth.token);
  await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [token, storedUser] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token && storedUser) {
        setAuthToken(token);
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string, mfaCode?: string) {
    const auth = await api.post<AuthResponse>("/api/mobile/auth/login", { email, password, mfaCode });
    await persistSession(auth);
    setUser(auth.user);
  }

  async function register(email: string, password: string, displayName: string) {
    const auth = await api.post<AuthResponse>("/api/mobile/auth/register", {
      email,
      password,
      displayName,
    });
    await persistSession(auth);
    setUser(auth.user);
  }

  async function logout() {
    setAuthToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
