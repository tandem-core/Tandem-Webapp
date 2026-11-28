import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NOTHING, Parts, setSharing, setViewer, useDemo } from '@/demo';
import { colors, fonts } from '@/theme';
import { Button, Card, Header, styles as ui } from '@/ui';

const OPTIONS: [keyof Parts, string, string][] = [
  ['summary', 'Summary', 'Main points and medicines'],
  ['transcript', 'Transcript', 'Written words from the visit'],
  ['recording', 'Recording', 'Audio from the visit'],
];

export default function Sharing() {
  const { sharing } = useDemo();
  const parts = sharing ?? NOTHING;
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title="Sharing with Lisa" />
      <ScrollView contentContainerStyle={[ui.content, { paddingTop: 4, paddingBottom: 28 }]}>
        <Text style={ui.body}>Choose what Lisa sees after each visit. Lisa can’t change this.</Text>
        <Card style={{ paddingVertical: 0 }}>
          {OPTIONS.map(([key, name, about], i) => {
            const on = parts[key];
            return (
              <Pressable
                key={key}
                onPress={() => setSharing({ ...parts, [key]: !on })}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}
                accessibilityRole="switch"
                aria-checked={on}
                accessibilityLabel={`Share ${name.toLowerCase()}`}>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.body, { fontFamily: fonts.semibold }]}>{name}</Text>
                  <Text style={ui.muted}>{about}</Text>
                </View>
                <View style={[s.toggle, on && { backgroundColor: colors.forest }]}>
                  <View style={[s.knob, on && { transform: [{ translateX: 22 }] }]} />
                </View>
              </Pressable>
            );
          })}
        </Card>
        <Button
          kind="ghost"
          label="See what Lisa sees"
          onPress={() => {
            setViewer('lisa');
            router.replace('/');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  toggle: { width: 56, height: 34, borderRadius: 99, backgroundColor: '#D9CFC2', padding: 4 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', transitionProperty: 'transform', transitionDuration: '200ms' },
});
