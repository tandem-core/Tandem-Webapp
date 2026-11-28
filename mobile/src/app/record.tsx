import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RECORDING, RecordingError, uploadRecording, VisitSummary } from '@/api';
import { sharesAnything, useDemo } from '@/demo';
import { clock } from '@/format';
import { colors, fonts } from '@/theme';
import { Button, Card, Header, styles as ui, Wave } from '@/ui';

// Mono speech at 48 kbps. Vercel accepts uploads up to about 4.5 MB, so recordings stop
// at 10 minutes. shortcut: longer appointments need direct upload to storage.
const MAX_MS = 10 * 60 * 1000;

type Stage =
  | { name: 'idle' }
  | { name: 'denied' }
  | { name: 'recording'; paused: boolean }
  | { name: 'preparing'; uri: string }
  | { name: 'ready'; visit: VisitSummary }
  | { name: 'failed'; uri: string; canRetry: boolean };

export default function Record() {
  const recorder = useAudioRecorder(RECORDING);
  const { durationMillis } = useAudioRecorderState(recorder, 500);
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const { sharing } = useDemo();
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Stops at the limit, counting only time spent recording.
  const keepGoing = () => {
    recorder.record();
    limit.current = setTimeout(finish, MAX_MS - recorder.getStatus().durationMillis);
  };

  const start = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return setStage({ name: 'denied' });
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    keepGoing();
    setStage({ name: 'recording', paused: false });
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

  const finish = async () => {
    clearTimeout(limit.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) send(recorder.uri);
    else setStage({ name: 'failed', uri: '', canRetry: false });
  };

  const pause = () => {
    if (stage.name !== 'recording') return;
    if (stage.paused) keepGoing();
    else {
      clearTimeout(limit.current);
      recorder.pause();
    }
    setStage({ name: 'recording', paused: !stage.paused });
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header title="Record" />
      <ScrollView contentContainerStyle={[ui.content, s.pane]}>
        {(stage.name === 'idle' || stage.name === 'denied') && (
          <>
            <Card style={{ gap: 12, marginTop: 8 }}>
              <Text style={ui.display}>Ready for your visit</Text>
              <Text style={ui.body}>Press the button on your Tandem device.</Text>
            </Card>
            <View style={s.actions}>
              {stage.name === 'denied' && <Text style={[ui.body, { color: colors.coralDeep }]}>Tandem needs the microphone. Allow it in settings.</Text>}
              <Button kind="ghost" label="Record on this phone instead" onPress={start} />
            </View>
          </>
        )}

        {stage.name === 'recording' && (
          <>
            <View style={{ alignItems: 'center', marginTop: 24, gap: 8 }} accessibilityLiveRegion="polite">
              <View style={[ui.row, { gap: 10, marginBottom: 6 }]}>
                {stage.paused ? <View style={[s.light, { opacity: 0.4 }]} /> : <Light />}
                <Text style={[ui.body, { color: colors.recRed, fontFamily: fonts.bold }]}>{stage.paused ? 'Paused' : 'Recording'}</Text>
              </View>
              <Text style={[ui.display, { fontSize: 44, lineHeight: 52 }]} accessibilityLabel={`Time ${clock(durationMillis / 1000)}`}>
                {clock(durationMillis / 1000)}
              </Text>
              <Text style={ui.muted}>This phone</Text>
            </View>
            <View style={{ alignItems: 'center', paddingVertical: 24, minHeight: 100 }}>{!stage.paused && <Wave color={colors.coral} large />}</View>
            <View style={s.actions}>
              <Button kind="ghost" label={stage.paused ? 'Resume' : 'Pause'} onPress={pause} />
              <Button kind="coral" label="Finish recording" onPress={finish} />
            </View>
          </>
        )}

        {stage.name === 'preparing' && (
          <Card style={{ gap: 14, marginTop: 16 }}>
            <ActivityIndicator color={colors.forest} style={{ alignSelf: 'flex-start' }} />
            <Text style={ui.display} accessibilityLiveRegion="polite">
              Preparing summary
            </Text>
            <Text style={ui.body}>Keep this screen open.</Text>
          </Card>
        )}

        {stage.name === 'ready' && (
          <>
            <Card style={{ gap: 10, marginTop: 16 }}>
              <Text style={ui.display} accessibilityLiveRegion="polite">
                Visit ready
              </Text>
              <Text style={ui.head}>{stage.visit.title}</Text>
              {sharesAnything(sharing) && <Text style={ui.body}>Shared with Lisa.</Text>}
            </Card>
            <View style={s.actions}>
              <Button label="Open visit" onPress={() => router.replace(`/appointments/${stage.visit.slug}`)} />
              <Button kind="ghost" label="Back to Home" onPress={() => router.replace('/')} />
            </View>
          </>
        )}

        {stage.name === 'failed' && (
          <>
            <Card style={{ gap: 10, marginTop: 16 }}>
              <Text style={ui.display} accessibilityLiveRegion="polite">
                Couldn’t prepare
              </Text>
              {stage.uri !== '' && <Text style={ui.body}>{stage.canRetry ? 'Your recording is still on this phone.' : 'Your recording is saved.'}</Text>}
            </Card>
            <View style={s.actions}>
              {stage.canRetry && stage.uri !== '' && <Button label="Try again" onPress={() => send(stage.uri)} />}
              <Button kind="ghost" label="Record again" onPress={() => setStage({ name: 'idle' })} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The pulsing red light, so everyone in the room can see Tandem is recording. */
function Light() {
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[s.light, { opacity: pulse }]} />;
}

const s = StyleSheet.create({
  pane: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: 24 },
  actions: { gap: 12 },
  light: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.recRed, boxShadow: '0 0 0 5px rgba(214, 52, 44, 0.2)' },
});
