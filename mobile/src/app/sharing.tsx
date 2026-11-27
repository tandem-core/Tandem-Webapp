import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NOTHING, Parts, setSharing, useDemo } from '@/demo';
import { colors, text, touch } from '@/theme';
import { styles as ui } from '@/ui';

const OPTIONS: [keyof Parts, string, string][] = [
  ['summary', 'Summary', 'What was decided and what to do next'],
  ['transcript', 'Transcript', 'Everything that was said, written out'],
  ['recording', 'Recording', 'The audio of the appointment'],
];

export default function Sharing() {
  const { sharing } = useDemo();
  const [parts, setParts] = useState<Parts>(sharing ?? NOTHING);
  // The screen stays mounted between visits; start from the saved choice each time.
  useFocusEffect(useCallback(() => setParts(sharing ?? NOTHING), [sharing]));

  const save = () => {
    setSharing(parts);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={28} color={colors.accent} />
        <Text style={s.backText}>Home</Text>
      </Pressable>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.pageTitle} accessibilityRole="header">
          What Lisa sees
        </Text>
        <Text style={ui.muted}>Shared after every appointment.</Text>
        {OPTIONS.map(([key, name, example]) => {
          const on = parts[key];
          return (
            <Pressable
              key={key}
              onPress={() => setParts((p) => ({ ...p, [key]: !p[key] }))}
              style={[s.option, on && s.optionOn]}
              accessibilityRole="checkbox"
              aria-checked={on}
              accessibilityLabel={`${name}: ${example}`}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={32} color={on ? colors.accent : colors.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[ui.body, { fontWeight: '700' }]}>{name}</Text>
                <Text style={ui.muted}>{example}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={save} style={[ui.button, { marginTop: 8 }]} accessibilityRole="button">
          <Text style={ui.buttonText}>Save</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', minHeight: touch, paddingHorizontal: 12 },
  backText: { fontSize: text.body, color: colors.accent, fontWeight: '600' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.accent },
});
