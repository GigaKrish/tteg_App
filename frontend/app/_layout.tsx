import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AuthProvider } from "../hooks/useAuth"; //
import { AppErrorBoundary } from "../components/AppErrorBoundary";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      {/* WRAPPER: Ensures Login screen can call 'login()' */}
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}