import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth, isAdminRole } from '../src/context/AuthContext';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Colors } from '../src/theme/colors';

// Custom light theme matching INUKA's color palette
const InukaLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.glassBorder,
    primary: Colors.primary,
    notification: Colors.primary,
  },
};

function RootLayoutNav() {
  const { user, loading, role, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inStudentGroup = segments[0] === '(student)';
    const inAdminGroup = segments[0] === '(admin)';
    const onSplash = !segments || segments.length < 1 || segments[0] === undefined;
    // Detect if we're currently on the onboarding screen itself
    const inOnboarding = inStudentGroup && segments[1] === 'onboarding';
    const inVerifyScreen = inAuthGroup && segments[1] === 'verify';

    if (!user && !inAuthGroup && !onSplash) {
      // Not authenticated → force to login
      router.replace('/login');
    } else if (user && !user.emailVerified) {
      // Authenticated but unverified email → force to verification screen
      if (!inVerifyScreen) {
        router.replace('/(auth)/verify');
      }
    } else if (user && (inAuthGroup || onSplash)) {
      // Authenticated user on the splash/auth screens → route by role
      if (isAdminRole(role)) {
        router.replace('/(admin)/(tabs)');
      } else if (role === 'student') {
        router.replace('/(student)/(tabs)');
      }
      // role === null → Firestore doc still loading, stay put
    } else if (user && role === 'student' && inAdminGroup) {
      router.replace('/(student)/(tabs)');
    } else if (user && isAdminRole(role) && inStudentGroup) {
      router.replace('/(admin)/(tabs)');
    }
  }, [user, loading, role, profile, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(student)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={InukaLightTheme}>
        <RootLayoutNav />
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}
