import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL, getVisit, useLoad, Visit } from '@/api';
import { markSeen, NOTHING, Parts, sharesAnything, useDemo } from '@/demo';
import { aboutMary, brief, clock, dateParts, labelChecks, otherChecks, shortDate } from '@/format';
import { colors, fonts } from '@/theme';
import { Card, Header, HearButton, LoadState, Locked, MedCheck, styles as ui } from '@/ui';

export default function AppointmentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const load = useCallback(() => getVisit(slug), [slug]);
  const { data, error, loading, reload } = useLoad(load);
  const { viewer, sharing } = useDemo();
  const lisa = viewer === 'lisa';
  const hidden = lisa && !sharesAnything(sharing);

  useEffect(() => {
    if (lisa && !hidden && data) markSeen(slug);
  }, [lisa, hidden, data, slug]);

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      {/* Lisa has no dock, so the list under this page would strand her. */}
      <Header fallback="/appointments" home={lisa} />
      {hidden ? (
        <View style={ui.content}>
          <Locked title="Nothing shared yet" note="Mary chooses what you see" />
        </View>
      ) : (
        <>
          <LoadState loading={loading} error={error} onRetry={reload} />
          {data && <AppointmentView visit={data} lisa={lisa} parts={lisa ? (sharing ?? NOTHING) : EVERYTHING} />}
        </>
      )}
    </SafeAreaView>
  );
}

const EVERYTHING: Parts = { summary: true, transcript: true, recording: true };
const PART_NAMES = { summary: 'Summary', transcript: 'Transcript', recording: 'Recording' } as const;

function AppointmentView({ visit, lisa, parts }: { visit: Visit; lisa: boolean; parts: Parts }) {
  const player = useAudioPlayer(parts.recording ? { uri: API_URL + visit.audioUrl } : null);
  const status = useAudioPlayerStatus(player);
  const say = lisa ? aboutMary : (t: string) => t;

  const startOf = (evidence: number[]) => visit.segments.find((seg) => seg.idx === evidence[0])?.start;
  // Without the recording, there is nothing to play (demo plan D7).
  const at = (evidence: number[]) => (parts.recording ? startOf(evidence) : undefined);
  const length = status.duration || visit.segments.at(-1)?.end || 0;
  const notShared = (Object.keys(PART_NAMES) as (keyof Parts)[]).filter((p) => !parts[p]).map((p) => PART_NAMES[p]);
  const names = visit.medications.flatMap((m) => [m.heardAs, m.suggestion?.name ?? '']);

  const playAt = (seconds: number) => {
    player.seekTo(seconds);
    player.play();
  };
  const hear = (evidence: number[]) => {
    const start = at(evidence);
    return start === undefined ? null : <HearButton at={start} onPress={() => playAt(start)} />;
  };
  const items = (list: { id: string; text?: string; title?: string; evidence: number[] }[]) =>
    list.map((i) => (
      <View key={i.id} style={{ gap: 8 }}>
        <Text style={ui.body}>{say(i.title ?? i.text ?? '')}</Text>
        {hear(i.evidence)}
      </View>
    ));
  const { weekday } = dateParts(visit.recordedAt);

  return (
    <ScrollView contentContainerStyle={[ui.content, { paddingTop: 0, paddingBottom: 32 }]}>
      <View style={{ gap: 4, marginBottom: 2 }}>
        <Text style={ui.display} accessibilityRole="header">
          {visit.title}
        </Text>
        <Text style={ui.muted}>
          {weekday} · {shortDate(visit.recordedAt)}
        </Text>
      </View>
      {parts.summary && visit.headline ? <Brief text={say(visit.headline)} names={names} /> : null}

      {parts.recording && (
        <View style={s.player}>
          <View style={[ui.row, { justifyContent: 'space-between', gap: 10 }]}>
            <HearButton solid playing={status.playing} onPress={() => (status.playing ? player.pause() : player.play())} />
            <Text style={[ui.muted, { fontFamily: fonts.semibold, color: colors.ink }]}>
              {clock(status.currentTime)} / {clock(length)}
            </Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${length ? Math.min(100, (status.currentTime / length) * 100) : 0}%` }]} />
          </View>
        </View>
      )}

      {/* Safety checks come before the details, so Mary sees them without scrolling. */}
      {parts.summary &&
        [...labelChecks(visit), ...otherChecks(visit)].map((med) => (
          <MedCheck key={med.id} slug={visit.slug} med={med} lisa={lisa} hear={hear(med.evidence)} />
        ))}
      {lisa && notShared.length > 0 && <Locked title={notShared.join(' & ')} note="Not shared by Mary" />}

      {(parts.summary || parts.transcript) && (
        // overflow hides the first row's divider under the card's edge.
        <Card style={{ paddingTop: 0, paddingBottom: 6, overflow: 'hidden' }}>
          {parts.summary && (
            <>
              <Fold title="What to do" open count={visit.followUps.length}>
                {items(visit.followUps)}
              </Fold>
              <Fold title={lisa ? 'What Mary was told' : 'What you were told'} count={visit.instructions.length}>
                {items(visit.instructions)}
              </Fold>
              <Fold title="What stayed the same" count={visit.unchanged.length}>
                {items(visit.unchanged)}
              </Fold>
              <Fold title="Questions to ask" count={visit.openQuestions.length}>
                {items(visit.openQuestions)}
              </Fold>
            </>
          )}
          {parts.transcript && (
            <Fold title="Transcript" count={visit.segments.length}>
              {visit.segments.map((seg) => (
                <View key={seg.idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  {parts.recording ? (
                    <Pressable
                      onPress={() => playAt(seg.start)}
                      style={s.time}
                      accessibilityRole="button"
                      accessibilityLabel={`Hear it, at ${clock(seg.start)}`}>
                      <Text style={s.timeText}>{clock(seg.start)}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[s.timeText, { width: 52, color: colors.muted }]}>{clock(seg.start)}</Text>
                  )}
                  <Text style={[ui.muted, { flex: 1, color: colors.ink }]}>{seg.text}</Text>
                </View>
              ))}
            </Fold>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

/** A heading that opens to show its details. Hidden when there is nothing in it. */
function Fold({ title, open = false, count, children }: { title: string; open?: boolean; count: number; children: ReactNode }) {
  const [shown, setShown] = useState(open);
  if (!count) return null;
  return (
    <View style={s.fold}>
      <Pressable onPress={() => setShown(!shown)} style={s.trigger} accessibilityRole="button" aria-expanded={shown}>
        <Text style={s.foldTitle}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} style={shown && { transform: [{ rotate: '90deg' }] }} />
      </Pressable>
      {shown && <View style={{ gap: 14, paddingBottom: 12 }}>{children}</View>}
    </View>
  );
}

/** The first part of a long summary, with the rest (never a medicine or a number) behind "More". */
function Brief({ text, names }: { text: string; names: string[] }) {
  const [all, setAll] = useState(false);
  const { short, rest } = brief(text, names);
  return (
    <Text style={ui.body}>
      {all || !rest ? text : short}
      {rest ? (
        <Text style={{ color: colors.forest, fontFamily: fonts.semibold }} onPress={() => setAll(!all)} accessibilityRole="button">
          {all ? ' Less' : ' More'}
        </Text>
      ) : null}
    </Text>
  );
}

const s = StyleSheet.create({
  player: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  track: { height: 6, borderRadius: 99, backgroundColor: '#EADFD1', marginVertical: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 99, backgroundColor: colors.forest },
  fold: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: -1, paddingVertical: 4 },
  trigger: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foldTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.forest },
  time: { width: 52, minHeight: 32, borderRadius: 10, backgroundColor: colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest, fontVariant: ['tabular-nums'] },
});
