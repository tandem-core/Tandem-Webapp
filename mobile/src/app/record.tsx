import Ionicons from '@expo/vector-icons/Ionicons';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RECORDING, RecordingError, uploadRecording, VisitSummary } from '@/api';
import { clock } from '@/format';
import { colors } from '@/theme';
import { AppointmentCard, styles as ui } from '@/ui';

// Mono speech at 48 kbps. Vercel accepts uploads up to about 4.5 MB, so recordings stop
// at 10 minutes. shortcut: longer appointments need direct upload to storage.
const MAX_MS = 10 * 60 * 1000;

type Stage =
  | { name: 'idle' }
  | { name: 'denied' }
  | { name: 'recording' }
  | { name: 'preparing'; uri: string }
  | { name: 'ready'; visit: VisitSummary }
  | { name: 'failed'; uri: string; canRetry: boolean };

export default function Record() {
  const recorder = useAudioRecorder(RECORDING);
  const recorderState = useAudioRecorderState(recorder, 500);
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined);

  const start = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return setStage({ name: 'denied' });
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStage({ name: 'recording' });
    limit.current = setTimeout(stop, MAX_MS);
  };

  const send = async (uri: string) => {
    setStage({ name: 'preparing', uri });
    try {
      setStage({ name: 'ready', visit: await uploadRecording(uri) });
    } catch (err) {
      // After processing_failed the recording is already saved; sending it again would duplicate it.
      const code = err instanceof RecordingError ? err.code : 'unknown';
      setStage({ name: 'failed', uri, canRetry: code !== 'processing_failed' });
    }
  };

  const stop = async () => {
    clearTimeout(limit.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) send(recorder.uri);
    else setStage({ name: 'failed', uri: '', canRetry: false });
  };

  const elapsed = recorderState.durationMillis;

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1 }]}>
        <Text style={ui.pageTitle} accessibilityRole="header">
          Record
        </Text>

        {(stage.name === 'idle' || stage.name === 'denied') && (
          <View style={s.center}>
            <View style={[s.ring, { backgroundColor: '#fdf0ec' }]}>
              <View style={[s.ring2, { backgroundColor: '#fbe2dc' }]}>
                <Pressable onPress={start} style={s.big} accessibilityRole="button" accessibilityLabel="Start recording">
                  <Ionicons name="mic-outline" size={60} color="#fff" />
                </Pressable>
              </View>
            </View>
            {stage.name === 'denied' ? (
              <Text style={[s.sub, { color: colors.accent }]}>Tandem needs the microphone. Allow it in settings.</Text>
            ) : (
              <Text style={s.sub}>Ask everyone first.</Text>
            )}
          </View>
        )}

        {stage.name === 'recording' && (
          <View style={s.center}>
            <View style={[s.ring, { backgroundColor: '#faece8' }]}>
              <View style={[s.ring2, { backgroundColor: '#f3dcd6' }]}>
                <Pressable onPress={stop} style={[s.big, { backgroundColor: '#26211e' }]} accessibilityRole="button" accessibilityLabel="Stop recording">
                  <View style={s.stopSquare} />
                </Pressable>
              </View>
            </View>
            <View style={s.row} accessibilityLiveRegion="polite">
              <View style={s.dot} />
              <Text style={s.label}>Recording</Text>
            </View>
            <Text style={s.timer}>{clock(elapsed / 1000)}</Text>
          </View>
        )}

        {stage.name === 'preparing' && (
          <View style={s.center} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={s.label}>Preparing…</Text>
          </View>
        )}

        {stage.name === 'ready' && (
          <View style={{ gap: 12, marginTop: 8 }} accessibilityLiveRegion="polite">
            <View style={s.row}>
              <Ionicons name="checkmark-circle" size={28} color={colors.green} />
              <Text style={s.label}>Ready</Text>
            </View>
            <AppointmentCard visit={stage.visit} />
            <Pressable onPress={() => setStage({ name: 'idle' })} style={ui.secondary} accessibilityRole="button">
              <Text style={ui.secondaryText}>New recording</Text>
            </Pressable>
          </View>
        )}

        {stage.name === 'failed' && (
          <View style={s.center} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={48} color="#d99428" />
            <Text style={s.label}>Couldn’t prepare</Text>
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
              {stage.canRetry && stage.uri !== '' && (
                <Pressable onPress={() => send(stage.uri)} style={ui.button} accessibilityRole="button">
                  <Text style={ui.buttonText}>Try again</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setStage({ name: 'idle' })} style={ui.secondary} accessibilityRole="button">
                <Text style={ui.secondaryText}>Record again</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 40 },
  ring: { width: 232, height: 232, borderRadius: 116, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ring2: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  big: { width: 168, height: 168, borderRadius: 84, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#ff5a40' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e0392b' },
  label: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: colors.text },
  sub: { fontSize: 16, lineHeight: 23, color: colors.muted, textAlign: 'center', paddingHorizontal: 12 },
  timer: { fontSize: 50, fontWeight: '700', letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
});