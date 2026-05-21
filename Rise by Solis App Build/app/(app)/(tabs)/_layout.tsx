import { Tabs } from 'expo-router';
import { PaletteC } from '@/design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: PaletteC.deepCharcoal,
          borderTopColor: PaletteC.warmGraphite,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: PaletteC.dawnGold,
        tabBarInactiveTintColor: PaletteC.dustyMocha,
      }}
    />
  );
}
