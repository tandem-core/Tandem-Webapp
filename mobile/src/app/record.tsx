import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordingError, uploadRecording, VisitSummary } from '@/api';
import { clock } from '@/format';
import { colors, text, touch } from '@/theme';
import { AppointmentCard, styles as ui } from '@/ui';

// Mono speech at 48 kbps. Vercel accepts uploads up to about 4.5 MB, so recordings stop
// at 10 minutes. shortcut: longer appointments need direct upload to storage.
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 48000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 48000 },
};
const MAX_MS = 10 * 60 * 1000;

type Stage =
  | { name: 'idle' }
  | { name: 'denied' }
  | { name: 'recording' }
  | { name: 'preparing'; uri: string }
  | { name: 'ready'; visit: VisitSummary }
  | { name: 'failed'; uri: string; canRetry: boolean };

export default function Record() {
  const recorder = useAudioRecorder(OPTIONS);
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
            <Pressable onPress={start} style={s.big} accessibilityRole="button" accessibilityLabel="Start recording">
              <Ionicons name="mic" size={64} color="#fff" />
            </Pressable>
            <Text style={[ui.body, { fontWeight: '700' }]}>Tap to start</Text>
            {stage.name === 'denied' ? (
              <Text style={[ui.body, { textAlign: 'center', color: colors.accent }]}>Tandem needs the microphone. Allow it in settings.</Text>
            ) : (
              <Text style={[ui.muted, { textAlign: 'center' }]}>Ask everyone in the room before you record.</Text>
            )}
          </View>
        )}

        {stage.name === 'recording' && (
          <View style={s.center}>
            <Pressable onPress={stop} style={s.big} accessibilityRole="button" accessibilityLabel="Stop recording">
              <View style={s.stopSquare} />
            </Pressable>
            <View style={[s.row]} accessibilityLiveRegion="polite">
              <View style={s.dot} />
              <Text style={[ui.body, { fontWeight: '700', color: colors.accent }]}>Recording</Text>
            </View>
            <Text style={s.timer}>{clock(elapsed / 1000)}</Text>
            <Text style={ui.muted}>Tap to stop</Text>
          </View>
        )}

        {stage.name === 'preparing' && (
          <View style={s.center} accessibilityLiveRegion="polite">
            <Ionicons name="hourglass-outline" size={56} color={colors.accent} />
            <Text style={ui.heading}>Preparing…</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>This can take a few minutes.</Text>
          </View>
        )}

        {stage.name === 'ready' && (
          <View style={{ gap: 14 }} accessibilityLiveRegion="polite">
            <View style={s.row}>
              <Ionicons name="checkmark-circle" size={36} color={colors.green} />
              <Text style={ui.heading}>Ready</Text>
            </View>
            <AppointmentCard visit={stage.visit} />
            <Pressable onPress={() => setStage({ name: 'idle' })} style={s.secondary} accessibilityRole="button">
              <Text style={s.secondaryText}>Record another</Text>
            </Pressable>
          </View>
        )}

        {stage.name === 'failed' && (
          <View style={s.center} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={56} color={colors.amber} />
            <Text style={ui.heading}>Couldn’t prepare</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>Tandem can’t prepare recordings right now.</Text>
            {stage.canRetry && stage.uri !== '' && (
              <Pressable onPress={() => send(stage.uri)} style={[ui.button, { alignSelf: 'stretch' }]} accessibilityRole="button">
                <Text style={ui.buttonText}>Try again</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setStage({ name: 'idle' })} style={[s.secondary, { alignSelf: 'stretch' }]} accessibilityRole="button">
              <Text style={s.secondaryText}>Record again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 24 },
  big: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  timer: { fontSize: 48, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  secondary: { minHeight: touch, borderRadius: 14, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  secondaryText: { fontSize: text.body, fontWeight: '700', color: colors.accent },
});
