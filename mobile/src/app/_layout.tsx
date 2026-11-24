import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Text } from 'react-native';

import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: [route: string, title: string, icon: IconName][] = [
  ['index', 'Home', 'home'],
  ['appointments', 'Appointments', 'calendar'],
  ['record', 'Record', 'mic'],
  ['todos', 'To-dos', 'checkbox'],
  ['prescriptions', 'Prescriptions', 'medkit'],
];

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { paddingTop: 6, backgroundColor: '#fff' },
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Ionicons name={icon} size={30} color={color as string} />,
            // Five tabs on a narrow phone: shrink long labels a little instead of cutting them off.
            tabBarLabel: ({ color }) => (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color, fontSize: 14, fontWeight: '600' }}>
                {title}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
