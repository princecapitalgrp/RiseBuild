import { Stack } from 'expo-router';
import { PaletteC } from '@/design/tokens';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: PaletteC.deepCharcoal },
        animation: 'slide_from_right',
      }}
    />
  );
}
