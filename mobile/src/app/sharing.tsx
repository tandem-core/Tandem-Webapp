import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NOTHING, Parts, setSharing, useDemo } from '@/demo';
import { colors } from '@/theme';
import { BackButton, styles as ui } from '@/ui';

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
      <BackButton label="Home" fallback="/" />
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
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? colors.accent : '#b3a89f'} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.title}>{name}</Text>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.accent },
});