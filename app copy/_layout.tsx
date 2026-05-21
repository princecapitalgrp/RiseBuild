import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@/design/tokens';
import { AuthProvider } from '@/context/AuthContext';
import { configureGoogleSignIn } from '@/services/AuthService';

// Configure Google Sign-In once at module load time.
// The webClientId is set inside AuthService — update it there.
configureGoogleSignIn();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Fonts and assets are loaded at app init.
    // Phase 8 will add custom font loading here.
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
