import { Stack } from 'expo-router';
import { PaletteB } from '@/design/tokens';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: PaletteB.warmCream },
        animation: 'slide_from_right',
      }}
    />
  );
}
