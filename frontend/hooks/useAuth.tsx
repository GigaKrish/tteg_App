import React, { useState, useEffect, useContext, createContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { authApi } from '../services/api/authApi';
import { apiClient } from '../services/api/apiClient';
import { STORAGE_KEYS, API_URL } from '../utils/constants';
import { clearSessionFormCache } from '../components/ReportFormModal';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);

  // 1. Loading States
  const [isLoading, setIsLoading] = useState(true); // For Splash Screen
  const [loading, setLoading] = useState(false);    // For Spinner
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // 2. Check Storage on App Launch
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
        const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.log("Error restoring session", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 3. LOGIN FUNCTION
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);

      // Handle your specific API response structure
      const token = response.token;

      if (token) {
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));

        setUser(response.user);

        // [CRITICAL FIX] Direct navigation for your flat folder structure
        router.replace('/map');
      } else {
        throw new Error("Login successful but no token received.");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // 4. REFRESH USER DATA (uses /auth/me which identifies user from JWT token)
  const refreshUser = async () => {
    try {
      if (!user?._id) return;
      const response = await apiClient.get<{ success: boolean; user: any }>('/auth/me');
      if (response.success && response.user) {
        setUser(response.user);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
      }
    } catch (e) {
      console.log('Error refreshing user:', e);
    }
  };



  // 5. LOGOUT FUNCTION
  const logout = async () => {
    try {
      // Unlock all user's devices before logging out
      if (user?._id) {
        await fetch(`${API_URL}/api/unlock-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id })
        }).catch(e => console.log('Error unlocking devices on logout:', e));
      }
    } catch (e) {
      console.log('Logout cleanup error:', e);
    }

    setUser(null);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    // Clear cached zone/ward data so next user gets fresh data
    await AsyncStorage.removeItem('cached_zones_wards').catch(() => {});
    // Clear memoized form fields
    clearSessionFormCache();
    router.replace('/login');
  };

  // 6. NAVIGATION GUARD (Simplified for Flat Structure)
  useEffect(() => {
    if (isLoading) return;

    // Get current screen name (e.g., "map", "login", "index")
    const currentScreen = segments[0] as string;

    // A. If NOT logged in...
    if (!user) {
      // ...and trying to access Map or protected pages -> Go to Login
      if (currentScreen !== 'login' && currentScreen !== 'signup' && currentScreen !== 'splash') {
        router.replace('/login');
      }
    }
    // B. If LOGGED IN...
    else if (user) {
      // ...and sitting on Login/Signup pages -> Go to Map
      if (currentScreen === 'login' || currentScreen === 'signup' || currentScreen === 'index') {
        router.replace('/map');
      }
    }
  }, [user, segments, isLoading, router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
