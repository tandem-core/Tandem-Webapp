import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, Text } from 'react-native';

import { useDemo } from '@/demo';
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
  const { viewer } = useDemo();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        // Web gives the bar a fixed height that clips labels under 30px icons.
        tabBarStyle: { paddingTop: 6, backgroundColor: '#fff', height: Platform.OS === 'web' ? 76 : undefined },
        tabBarItemStyle: { paddingHorizontal: 2 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}>
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // Lisa doesn't record Mary's appointments.
            href: viewer === 'lisa' && name === 'record' ? null : undefined,
            tabBarIcon: ({ color }) => <Ionicons name={icon} size={30} color={color as string} />,
            // Five tabs on a narrow phone: shrink long labels a little instead of cutting them off.
            // Web can't shrink text to fit, so it keeps the standard label.
            tabBarLabel:
              Platform.OS === 'web'
                ? undefined
                : ({ color }) => (
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
