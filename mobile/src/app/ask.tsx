import Ionicons from '@expo/vector-icons/Ionicons';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { ComponentRef, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, askSpoken, askTurn, RECORDING, RecordingError, Turn } from '@/api';
import { answerOf, dateParts } from '@/format';
import { colors } from '@/theme';
import { BackButton, styles as ui } from '@/ui';

const SUGGESTIONS = ['My new dose?', 'Next visit?'];

type Entry = { question: string; turn?: Turn; failed?: string; readOnly?: boolean };

export default function Ask() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const session = useRef<string | undefined>(undefined);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const player = useAudioPlayer(null);
  const recorder = useAudioRecorder(RECORDING);
  const last = entries.at(-1)?.turn;

  const play = (url: string) => {
    Speech.stop();
    player.replace({ uri: url.startsWith('/') ? API_URL + url : url });
    player.play();
  };
  // The server's voice when it has one, otherwise the phone's. The written answer stays on
  // screen. With the server's voice only the first line (the answer) plays.
  const say = async (turn: Turn) => {
    const speak = turn.actions.find((a) => a.type === 'speak');
    const url = speak?.type === 'speak' ? speak.url : null;
    if (!url) return Speech.speak(answerOf(turn), { rate: 0.9 });
    if (!url.includes('check=1')) return play(url);
    // Checked speech: the server refuses audio that skipped a number or name, so fetch it
    // first and only play what passed.
    const res = await fetch(API_URL + url).catch(() => null);
    if (!res?.ok) return setEntries((e) => e.map((x) => (x.turn === turn ? { ...x, readOnly: true } : x)));
    play(Platform.OS === 'web' ? URL.createObjectURL(await res.blob()) : url);
  };

  const run = async (shown: string, get: () => Promise<Turn>, speak = false) => {
    Speech.stop();
    player.pause();
    setBusy(true);
    setDraft('');
    setEntries((e) => [...e, { question: shown }]);
    try {
      const turn = await get();
      session.current = turn.sessionId;
      setEntries((e) => [...e.slice(0, -1), { question: turn.heard || shown, turn }]);
      if (speak) say(turn);
    } catch (err) {
      const failed = err instanceof RecordingError && err.code !== 'offline' ? 'Voice isn’t working. Please type.' : 'Couldn’t send. Check your internet.';
      setEntries((e) => [...e.slice(0, -1), { question: shown, failed }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };
  const send = (shown: string, body: { event: 'question' | 'choose'; text?: string; slug?: string }) => {
    if (!busy && shown.trim()) run(shown, () => askTurn({ ...body, sessionId: session.current }));
  };
  const ask = (q: string) => send(q, { event: 'question', text: q });

  const talk = async () => {
    if (listening) {
      setListening(false);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (uri) run('Spoken question', () => askSpoken(uri, session.current), true);
      return;
    }
    if (busy || !(await requestRecordingPermissionsAsync()).granted) return;
    Speech.stop();
    player.pause();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setListening(true);
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <BackButton label="Home" fallback="/" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={ui.content}>
          <Text style={ui.pageTitle} accessibilityRole="header">
            Ask
          </Text>
          {entries.length === 0 && (
            <View style={s.chips}>
              {SUGGESTIONS.map((q) => (
                <Pressable key={q} onPress={() => ask(q)} style={s.chip} accessibilityRole="button">
                  <Text style={s.chipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {entries.map((entry, i) => (
            <View key={i} style={{ gap: 10 }}>
              <Text style={s.question}>{entry.question}</Text>
              {entry.failed && <Text style={s.answer}>{entry.failed}</Text>}
              {!entry.turn && !entry.failed && <Text style={[s.answer, { color: colors.muted }]}>…</Text>}
              {entry.turn && (
                <View style={s.answerBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={[s.answer, { flex: 1 }]}>{answerOf(entry.turn)}</Text>
                    <Pressable
                      onPress={() => say(entry.turn!)}
                      style={s.icon}
                      accessibilityRole="button"
                      accessibilityLabel="Read aloud">
                      <Ionicons name="volume-high-outline" size={22} color={colors.accent} />
                    </Pressable>
                  </View>
                  {entry.readOnly && <Text style={ui.muted}>Read the answer on screen.</Text>}
                  {entry.turn.actions.map((a, j) =>
                    a.type === 'play' ? (
                      <Pressable key={j} onPress={() => play(a.url)} style={s.clip} accessibilityRole="button" accessibilityLabel={`Hear it: ${a.text}`}>
                        <Ionicons name="play" size={14} color={colors.accentDark} />
                        <Text style={[ui.muted, { flex: 1, color: colors.accentDark, fontWeight: '700' }]}>Hear it</Text>
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
          {listening ? (
            <Text style={[s.input, { lineHeight: 45, color: colors.accent, fontWeight: '700' }]}>Listening…</Text>
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => ask(draft)}
              placeholder="Ask a question"
              placeholderTextColor={colors.muted}
              style={s.input}
              returnKeyType="send"
              accessibilityLabel="Your question"
            />
          )}
          {draft.trim() && !listening ? (
            <Pressable onPress={() => ask(draft)} disabled={busy} style={[s.send, busy && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send">
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              onPress={talk}
              disabled={busy}
              style={[s.send, busy && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Send spoken question' : 'Speak a question'}>
              <Ionicons name={listening ? 'stop' : 'mic-outline'} size={22} color="#fff" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#f3e9e2' },
  chipText: { fontSize: 15.5, color: '#7a4a38', fontWeight: '600' },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
    backgroundColor: colors.accent,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  answerBox: { backgroundColor: colors.card, borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  answer: { fontSize: 16, lineHeight: 24, color: colors.body },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  clip: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.accentSoft },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: '#eee6de', backgroundColor: '#fff' },
  input: { flex: 1, height: 48, fontSize: 16, color: colors.text, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#e3d5ca', backgroundColor: '#fff' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});