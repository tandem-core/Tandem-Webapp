import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, Text } from 'react-native';

import { useDemo } from '@/demo';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: [route: string, title: string, icon: IconName][] = [
  ['index', 'Home', 'home-outline'],
  ['appointments', 'Appointments', 'calendar-outline'],
  ['record', 'Record', 'mic-outline'],
  ['todos', 'To-dos', 'checkbox-outline'],
  ['prescriptions', 'Prescriptions', 'medkit-outline'],
];

export default function Layout() {
  const { viewer } = useDemo();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#94897f',
        // Web gives the bar a fixed height; leave room for the icon and its label.
        tabBarStyle: { paddingTop: 6, backgroundColor: '#fff', borderTopColor: '#eee6de', height: Platform.OS === 'web' ? 64 : undefined },
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // Lisa doesn't record Mary's appointments. (href: null would break the route in this SDK.)
            ...(viewer === 'lisa' && name === 'record' && { tabBarItemStyle: { display: 'none' }, tabBarButton: () => null }),
            tabBarIcon: ({ color }) => <Ionicons name={icon} size={24} color={color as string} />,
            // Five tabs on a narrow phone: shrink long labels a little instead of cutting them off.
            // Web can't shrink to fit, so it lets "Appointments" run slightly past its tab; its neighbors are short.
            tabBarLabel: ({ color }) =>
              Platform.OS === 'web' ? (
                <Text style={{ color, fontSize: 11.5, fontWeight: '600' }}>{title}</Text>
              ) : (
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color, fontSize: 12, fontWeight: '600' }}>
                  {title}
                </Text>
              ),
          }}
        />
      ))}
      {/* Opened from Home, not tabs. (href: null would also drop the route in this SDK.) */}
      {['ask', 'sharing'].map((name) => (
        <Tabs.Screen key={name} name={name} options={{ tabBarItemStyle: { display: 'none' }, tabBarButton: () => null }} />
      ))}
    </Tabs>
  );
}
