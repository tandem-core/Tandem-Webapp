import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { Href, router, Tabs, useSegments } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDemo } from '@/demo';
import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Route, label, icon. Chat and Record open full screen over the tabs.
const MARY: [string, string, IconName][] = [
  ['index', 'Home', 'home-outline'],
  ['appointments', 'Visits', 'calendar-outline'],
  ['ask', 'Chat', 'chatbubble-outline'],
  ['todos', 'To-dos', 'checkbox-outline'],
  ['prescriptions', 'Meds', 'medkit-outline'],
  ['record', 'Record', 'ellipse'],
];

// Screens that fill the phone, with their own back button.
const FULL = ['ask', 'record', 'sharing', '[slug]'];

function Dock({ state }: BottomTabBarProps) {
  const { viewer } = useDemo();
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  // Lisa's view is one screen, as in the prototype.
  if (viewer === 'lisa' || segments.some((s) => FULL.includes(s))) return null;
  const current = state.routes[state.index].name;
  return (
    <View style={[s.dock, { bottom: Math.max(14, insets.bottom) }]} accessibilityRole="tablist">
      {MARY.map(([name, label, icon]) => {
        const active = current === name;
        const record = name === 'record';
        const href = (name === 'index' ? '/' : `/${name}`) as Href;
        const go = () => (name === 'ask' || record ? router.push(href) : router.navigate(href));
        return (
          <Pressable
            key={name}
            onPress={go}
            style={[s.item, active && s.active, record && s.record]}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={label}>
            {record ? <View style={s.dot} /> : <Ionicons name={icon} size={21} color={active ? colors.forest : colors.muted} />}
            <Text style={[s.label, active && { color: colors.forest }, record && { color: '#fff' }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Layout() {
  const [loaded] = useFonts({
    YoungSerif: require('../../assets/fonts/YoungSerif-Regular.ttf'),
    Outfit400: require('../../assets/fonts/Outfit-400.ttf'),
    Outfit500: require('../../assets/fonts/Outfit-500.ttf'),
    Outfit600: require('../../assets/fonts/Outfit-600.ttf'),
    Outfit700: require('../../assets/fonts/Outfit-700.ttf'),
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return (
    <Tabs tabBar={(props) => <Dock {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}>
      {['index', 'appointments', 'ask', 'todos', 'prescriptions', 'record', 'sharing'].map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 2,
    padding: 6,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    borderColor: colors.line,
    boxShadow: '0 12px 30px rgba(23, 75, 60, 0.12)',
  },
  item: { flex: 1, minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 3 },
  active: { backgroundColor: colors.forestSoft },
  record: { backgroundColor: colors.coral, borderRadius: 20 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.3)', marginVertical: 5 },
  label: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted },
});
