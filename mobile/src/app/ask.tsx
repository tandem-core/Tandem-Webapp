import Ionicons from '@expo/vector-icons/Ionicons';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { ComponentRef, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, askSpoken, askTurn, RECORDING, RecordingError, Turn } from '@/api';
import { answerOf, shortDate } from '@/format';
import { colors, fonts } from '@/theme';
import { Button, Header, HearButton, styles as ui, Wave } from '@/ui';

const SUGGESTIONS = ['My current dose?', 'What changed last time?', 'Next visit?'];

type Entry = { question: string; turn?: Turn; failed?: string; readOnly?: boolean };

export default function Chat() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const session = useRef<string | undefined>(undefined);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RECORDING);
  const last = entries.at(-1)?.turn;
  // What is playing: a turn's answer ("turn:<session>:<i>") or a quote's clip URL.
  const now = status.playing ? playing : null;

  const play = (url: string, id: string) => {
    Speech.stop();
    if (now === id) return player.pause();
    setPlaying(id);
    player.replace({ uri: url.startsWith('/') || url.startsWith('?') ? API_URL + url : url });
    player.play();
  };
  // The server's voice when it has one, otherwise the phone's. The written answer stays on screen.
  const say = async (turn: Turn, id: string) => {
    const speak = turn.actions.find((a) => a.type === 'speak');
    const url = speak?.type === 'speak' ? speak.url : null;
    if (!url) return Speech.speak(answerOf(turn), { rate: 0.9 });
    if (!url.includes('check=1')) return play(url, id);
    // Checked speech: the server refuses audio that skipped a number or name, so fetch it
    // first and only play what passed.
    const res = await fetch(API_URL + url).catch(() => null);
    if (!res?.ok) return setEntries((e) => e.map((x) => (x.turn === turn ? { ...x, readOnly: true } : x)));
    play(Platform.OS === 'web' ? URL.createObjectURL(await res.blob()) : url, id);
  };

  const run = async (shown: string, get: () => Promise<Turn>, speak = false) => {
    Speech.stop();
    player.pause();
    setBusy(true);
    setDraft('');
    setEntries((e) => [...e, { question: shown }]);
    const index = entries.length;
    try {
      const turn = await get();
      session.current = turn.sessionId;
      setEntries((e) => [...e.slice(0, -1), { question: turn.heard || shown, turn }]);
      if (speak) say(turn, `turn:${index}`);
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
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Header title="Tandem" />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={[ui.content, { paddingTop: 16, paddingBottom: 12 }]}>
          {entries.length === 0 && (
            <View style={s.bot}>
              <Text style={s.botText}>Ask me about your visits.</Text>
            </View>
          )}
          {entries.map((entry, i) => (
            <View key={i} style={{ gap: 14 }}>
              <Text style={s.user}>{entry.question}</Text>
              {entry.failed && (
                <View style={s.bot}>
                  <Text style={s.botText}>{entry.failed}</Text>
                </View>
              )}
              {!entry.turn && !entry.failed && (
                <View style={[s.bot, { paddingVertical: 18 }]} accessibilityLabel="Thinking">
                  <Wave />
                </View>
              )}
              {entry.turn && (
                <View style={s.bot}>
                  {now === `turn:${i}` && (
                    <View style={[ui.row, { gap: 10 }]}>
                      <Wave />
                      <Text style={[ui.muted, { fontSize: 15 }]}>Reading aloud</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <Text style={[s.botText, { flex: 1 }]}>{answerOf(entry.turn)}</Text>
                    <Pressable
                      onPress={() => say(entry.turn!, `turn:${i}`)}
                      style={s.speaker}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={now === `turn:${i}` ? 'Stop reading' : 'Read aloud'}>
                      <Ionicons name={now === `turn:${i}` ? 'pause' : 'volume-high-outline'} size={20} color={colors.forest} />
                    </Pressable>
                  </View>
                  {entry.readOnly && <Text style={ui.muted}>Read the answer on screen.</Text>}
                  {entry.turn.actions
                    .filter((a) => a.type === 'play')
                    .map((a, j) => (
                      <View key={j} style={s.quote}>
                        {/* The few words the answer rests on; the clip plays the sentences around them. */}
                        <Text style={s.quoteText}>“{(entry.turn!.result?.clips?.[j]?.quote ?? a.text).trim()}”</Text>
                        <HearButton solid at={a.start} playing={now === a.url} onPress={() => play(a.url, a.url)} />
                      </View>
                    ))}
                  {entry.turn === last && last.expect === 'yes_no' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <Button label="Yes, ask Lisa" onPress={() => send('Yes, ask Lisa', { event: 'question', text: 'Yes' })} />
                      <Button label="No" kind="ghost" onPress={() => send('No', { event: 'question', text: 'No' })} />
                    </View>
                  )}
                  {entry.turn === last &&
                    last.expect === 'choice' &&
                    last.result?.options?.map((o) => (
                      <Button
                        key={o.slug}
                        kind="ghost"
                        label={`${o.title} · ${shortDate(o.recordedAt)}`}
                        onPress={() => send(o.title, { event: 'choose', slug: o.slug })}
                      />
                    ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chips}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled">
          {SUGGESTIONS.map((q) => (
            <Pressable key={q} onPress={() => ask(q)} style={s.chip} accessibilityRole="button">
              <Text style={s.chipText}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.composer}>
          {listening ? (
            <View style={[s.input, ui.row, { gap: 10 }]}>
              <Wave color={colors.coral} />
              <Text style={[ui.body, { color: colors.coralDeep, fontSize: 17 }]}>Listening…</Text>
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => ask(draft)}
              placeholder="Ask Tandem…"
              placeholderTextColor={colors.muted}
              style={s.input}
              returnKeyType="send"
              accessibilityLabel="Your question"
            />
          )}
          <Pressable
            onPress={talk}
            disabled={busy}
            style={[s.square, listening ? { backgroundColor: colors.coral } : s.ghost, busy && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Send spoken question' : 'Speak a question'}>
            <Ionicons name={listening ? 'stop' : 'mic-outline'} size={21} color={listening ? '#fff' : colors.forest} />
          </Pressable>
          {!listening && (
            <Pressable
              onPress={() => ask(draft)}
              disabled={busy || !draft.trim()}
              style={[s.square, (busy || !draft.trim()) && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Send">
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  user: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    backgroundColor: colors.forest,
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 17.5,
    lineHeight: 24,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
  },
  bot: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
    gap: 10,
    boxShadow: '0 6px 18px rgba(23, 75, 60, 0.05)',
  },
  botText: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 25, color: colors.ink },
  speaker: { width: 36, height: 36, marginTop: -6, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  quote: { borderLeftWidth: 3.5, borderLeftColor: colors.forest, paddingVertical: 4, paddingLeft: 12, gap: 8, alignItems: 'flex-start' },
  quoteText: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 25, color: colors.ink },
  chips: { flexGrow: 0, paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.canvas },
  chip: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.forest },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 18, paddingHorizontal: 16, backgroundColor: colors.surface },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 17,
    backgroundColor: colors.canvas,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
  },
  square: {
    width: 48,
    height: 48,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 17,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { backgroundColor: colors.canvas, borderWidth: 1.5, borderColor: colors.line },
});
