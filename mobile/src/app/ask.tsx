import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ComponentRef, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, askTurn, Turn } from '@/api';
import { answerOf, dateParts } from '@/format';
import { colors, text, touch } from '@/theme';
import { styles as ui } from '@/ui';

const SUGGESTIONS = ['What’s my new dose?', 'When’s my follow-up?'];

type Entry = { question: string; turn?: Turn; failed?: boolean };

export default function Ask() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<string | undefined>(undefined);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const player = useAudioPlayer(null);
  const last = entries.at(-1)?.turn;

  const send = async (shown: string, body: { event: 'question' | 'choose'; text?: string; slug?: string }) => {
    if (busy || !shown.trim()) return;
    Speech.stop();
    setBusy(true);
    setDraft('');
    setEntries((e) => [...e, { question: shown }]);
    try {
      const turn = await askTurn({ ...body, sessionId: session.current });
      session.current = turn.sessionId;
      setEntries((e) => [...e.slice(0, -1), { question: shown, turn }]);
    } catch {
      setEntries((e) => [...e.slice(0, -1), { question: shown, failed: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };
  const ask = (q: string) => send(q, { event: 'question', text: q });

  const playClip = (url: string) => {
    Speech.stop();
    player.replace({ uri: url.startsWith('/') ? API_URL + url : url });
    player.play();
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={28} color={colors.accent} />
        <Text style={s.backText}>Home</Text>
      </Pressable>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={ui.content}>
          <Text style={ui.pageTitle} accessibilityRole="header">
            Ask
          </Text>
          {entries.length === 0 &&
            SUGGESTIONS.map((q) => (
              <Pressable key={q} onPress={() => ask(q)} style={s.chip} accessibilityRole="button">
                <Text style={s.chipText}>{q}</Text>
              </Pressable>
            ))}
          {entries.map((entry, i) => (
            <View key={i} style={{ gap: 10 }}>
              <Text style={s.question}>{entry.question}</Text>
              {entry.failed && <Text style={s.answer}>Couldn’t send. Check your internet.</Text>}
              {!entry.turn && !entry.failed && <Text style={[s.answer, { color: colors.muted }]}>…</Text>}
              {entry.turn && (
                <View style={s.answerBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={[s.answer, { flex: 1 }]}>{answerOf(entry.turn)}</Text>
                    <Pressable
                      onPress={() => Speech.speak(answerOf(entry.turn!), { rate: 0.9 })}
                      style={s.icon}
                      accessibilityRole="button"
                      accessibilityLabel="Read aloud">
                      <Ionicons name="volume-high" size={26} color={colors.accent} />
                    </Pressable>
                  </View>
                  {entry.turn.actions.map((a, j) =>
                    a.type === 'play' ? (
                      <Pressable key={j} onPress={() => playClip(a.url)} style={s.clip} accessibilityRole="button" accessibilityLabel={`Hear it: ${a.text}`}>
                        <Ionicons name="play" size={20} color={colors.accent} />
                        <Text style={[ui.muted, { flex: 1 }]} numberOfLines={2}>
                          “{a.text}”
                        </Text>
                      </Pressable>
                    ) : null,
                  )}
                </View>
              )}
            </View>
          ))}
          {last?.expect === 'choice' &&
            last.result?.options?.map((o) => {
              const { month, day } = dateParts(o.recordedAt);
              return (
                <Pressable key={o.slug} onPress={() => send(o.title, { event: 'choose', slug: o.slug })} style={s.chip} accessibilityRole="button">
                  <Text style={s.chipText}>
                    {o.title} · {month.slice(0, 3)} {day}
                  </Text>
                </Pressable>
              );
            })}
          {last?.expect === 'yes_no' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['Yes', 'No'].map((a) => (
                <Pressable key={a} onPress={() => ask(a)} style={[s.chip, { flex: 1, alignItems: 'center' }]} accessibilityRole="button">
                  <Text style={s.chipText}>{a}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={s.bar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => ask(draft)}
            placeholder="Ask about your appointments"
            placeholderTextColor={colors.muted}
            style={s.input}
            returnKeyType="send"
            accessibilityLabel="Your question"
          />
          <Pressable onPress={() => ask(draft)} disabled={busy || !draft.trim()} style={[s.send, (busy || !draft.trim()) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send">
            <Ionicons name="arrow-up" size={28} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', minHeight: touch, paddingHorizontal: 12 },
  backText: { fontSize: text.body, color: colors.accent, fontWeight: '600' },
  chip: { minHeight: touch, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 16, borderWidth: 2, borderColor: colors.accent, backgroundColor: '#fff' },
  chipText: { fontSize: text.body, color: colors.accent, fontWeight: '700' },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    fontSize: text.body,
    color: '#fff',
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  answerBox: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  answer: { fontSize: text.body, lineHeight: 28, color: colors.text },
  icon: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginRight: -12 },
  clip: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  input: { flex: 1, minHeight: touch, fontSize: text.body, color: colors.text, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.background },
  send: { width: touch, height: touch, borderRadius: touch / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
