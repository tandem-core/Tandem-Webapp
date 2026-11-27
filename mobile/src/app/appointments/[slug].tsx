import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Answer, answerMedication, API_URL, getVisit, Medication, useLoad, Visit } from '@/api';
import { markSeen, NOTHING, Parts, sharesAnything, useDemo } from '@/demo';
import { aboutMary, checkReason, clock, dateParts, doseOf, labelChecks, markerPositions, otherChecks } from '@/format';
import { colors } from '@/theme';
import { BackButton, LoadState, styles as ui } from '@/ui';

export default function AppointmentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const load = useCallback(() => getVisit(slug), [slug]);
  const { data, error, loading, reload } = useLoad(load);
  const { viewer, sharing } = useDemo();
  const lisa = viewer === 'lisa';
  const parts = lisa ? (sharing ?? NOTHING) : EVERYTHING;
  const hidden = lisa && !sharesAnything(sharing);

  useEffect(() => {
    if (lisa && !hidden && data) markSeen(slug);
  }, [lisa, hidden, data, slug]);

  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <BackButton label="Appointments" fallback="/appointments" />
      {hidden ? (
        <Text style={[ui.body, { padding: 20 }]}>Mary hasn’t shared this.</Text>
      ) : (
        <>
          <LoadState loading={loading} error={error} onRetry={reload} />
          {data && <AppointmentView visit={data} lisa={lisa} parts={parts} />}
        </>
      )}
    </SafeAreaView>
  );
}

const EVERYTHING: Parts = { summary: true, transcript: true, recording: true };

function AppointmentView({ visit, lisa, parts }: { visit: Visit; lisa: boolean; parts: Parts }) {
  const player = useAudioPlayer(parts.recording ? { uri: API_URL + visit.audioUrl } : null);
  const status = useAudioPlayerStatus(player);
  const say = lisa ? aboutMary : (t: string) => t;

  const startOf = (evidence: number[]) => visit.segments.find((seg) => seg.idx === evidence[0])?.start;
  // Without the recording, takeaways have no timestamps to play (demo plan D7).
  const at = (evidence: number[]) => (parts.recording ? startOf(evidence) : undefined);
  const moments = parts.recording
    ? visit.followUps
        .map((f) => ({ ...f, start: startOf(f.evidence) }))
        .filter((m): m is typeof m & { start: number } => m.start !== undefined)
        .sort((a, b) => a.start - b.start)
    : [];

  const length = status.duration || visit.segments.at(-1)?.end || 0;
  const markers = markerPositions(
    moments.map((m) => m.start),
    length,
  );
  const current = status.currentTime > 0 ? moments.findLast((m) => m.start <= status.currentTime + 0.5) : undefined;
  const { month, day } = dateParts(visit.recordedAt);
  const minutes = Math.round((visit.segments.at(-1)?.end ?? 0) / 60);
  const notShared = (['summary', 'transcript', 'recording'] as const).filter((p) => !parts[p]);

  const playAt = (seconds: number) => {
    player.seekTo(seconds);
    player.play();
  };

  return (
    <>
      <ScrollView contentContainerStyle={[ui.content, { paddingTop: 0 }, parts.recording && { paddingBottom: 120 }]}>
        <Text style={s.title} accessibilityRole="header">
          {visit.title}
        </Text>
        <Text style={s.meta}>
          {month} {day}
          {minutes > 0 ? ` · ${minutes} min` : ''}
        </Text>
        {lisa && notShared.length > 0 && (
          <View style={s.locked}>
            <Ionicons name="lock-closed" size={16} color="#8b7d72" />
            <Text style={[ui.muted, { flex: 1, color: '#5b524b' }]}>Mary didn’t share the {notShared.join(' or ')}.</Text>
          </View>
        )}

        {parts.summary && (
          <>
            {labelChecks(visit).map((med) => (
              <LabelCheck key={med.id} slug={visit.slug} med={med} lisa={lisa} start={at(med.evidence)} onHear={playAt} />
            ))}
            {otherChecks(visit).map((med) => {
              const start = at(med.evidence);
              return (
                <View key={med.id} style={s.check}>
                  <View style={s.checkHead}>
                    <Text style={s.checkLabel}>Please check</Text>
                    {start !== undefined && <HearButton at={start} onHear={playAt} />}
                  </View>
                  <Text style={s.checkQuestion}>{checkReason(med)}</Text>
                  <Text style={ui.muted}>
                    {lisa ? 'Mary should ask her pharmacist before changing anything.' : 'Ask your pharmacist before changing anything.'}
                  </Text>
                </View>
              );
            })}

            <View style={s.labelRow}>
              <Text style={s.section}>Summary</Text>
              <Text style={s.ai}>{visit.reviewed ? 'AI-generated' : 'AI-generated · not reviewed'}</Text>
            </View>
            <Text style={s.para}>{say(visit.headline ?? '')}</Text>

            <Group
              title="What to do"
              items={[
                ...moments.map((m, i) => ({
                  id: m.id,
                  main: say(m.title),
                  sub: m.when,
                  bold: true,
                  number: i + 1,
                  flag: m.uncheckedMedication,
                  now: current?.id === m.id,
                  start: m.start,
                })),
                ...visit.followUps.filter((f) => !moments.some((m) => m.id === f.id)).map((f) => ({ id: f.id, main: say(f.title), sub: f.when, bold: true })),
              ]}
              onHear={playAt}
            />
            <Group
              title={lisa ? 'What Mary was told' : 'What you were told'}
              items={visit.instructions.map((i) => ({ id: i.id, main: say(i.text), start: at(i.evidence) }))}
              onHear={playAt}
            />
            <Group title="What stayed the same" items={visit.unchanged.map((i) => ({ id: i.id, main: say(i.text), start: at(i.evidence) }))} onHear={playAt} />
            <Group
              title="Questions to ask"
              items={visit.openQuestions.map((q) => ({ id: q.id, main: say(q.text), bold: true, start: at(q.evidence) }))}
              onHear={playAt}
            />
          </>
        )}

        {parts.transcript && <Transcript segments={visit.segments} onHear={parts.recording ? playAt : undefined} />}
      </ScrollView>

      {parts.recording && (
        <View style={s.player}>
          <View style={s.row}>
            <Pressable
              onPress={() => (status.playing ? player.pause() : player.play())}
              style={s.playButton}
              accessibilityRole="button"
              accessibilityLabel={status.playing ? 'Pause recording' : 'Play recording'}>
              <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={colors.text} style={!status.playing && { marginLeft: 2 }} />
            </Pressable>
            <Text style={s.playerTitle} numberOfLines={1}>
              {!status.isLoaded ? 'Loading…' : current ? `${moments.indexOf(current) + 1} · ${say(current.title)}` : 'Recording'}
            </Text>
            <Text style={s.playerTime}>
              {clock(status.currentTime)} / {clock(length)}
            </Text>
          </View>
          <View style={s.track}>
            <View style={[s.trackFill, { width: `${length ? (status.currentTime / length) * 100 : 0}%` }]} />
            {length > 0 &&
              moments.map((m, i) => (
                <Text key={m.id} style={[s.marker, m.uncheckedMedication && s.markerFlag, current?.id === m.id && s.markerNow, { left: `${markers[i]}%` }]}>
                  {i + 1}
                </Text>
              ))}
          </View>
        </View>
      )}
    </>
  );
}

/** The word-for-word transcript, folded away until asked for. */
function Transcript({ segments, onHear }: { segments: Visit['segments']; onHear?: (seconds: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 6 }}>
      <Pressable onPress={() => setOpen(!open)} style={s.fold} accessibilityRole="button" aria-expanded={open}>
        <Text style={[s.section, { flex: 1 }]}>Transcript</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={s.list}>
          {segments.map((seg, i) => (
            <View key={seg.idx} style={[s.line, i > 0 && s.divider]}>
              {onHear ? (
                <Pressable
                  onPress={() => onHear(seg.start)}
                  style={s.lineTime}
                  accessibilityRole="button"
                  accessibilityLabel={`Hear it, at ${clock(seg.start)}`}>
                  <Text style={s.hearText}>{clock(seg.start)}</Text>
                </Pressable>
              ) : (
                <Text style={[s.lineTime, s.timeText]}>{clock(seg.start)}</Text>
              )}
              <Text style={s.lineText}>{seg.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LabelCheck({ slug, med, lisa, start, onHear }: { slug: string; med: Medication; lisa: boolean; start?: number; onHear: (seconds: number) => void }) {
  const [answer, setAnswer] = useState(med.ownerAnswer?.answer ?? null);
  const [failed, setFailed] = useState(false);
  const dose = doseOf(med);
  const name = `${med.suggestion?.name}${dose ? ` ${dose}` : ''}`;

  const choose = (next: Answer) => {
    const before = answer;
    setAnswer(next);
    setFailed(false);
    answerMedication(slug, med.id, next).catch(() => {
      setAnswer(before);
      setFailed(true);
    });
  };

  const choices: [Answer, string][] = [
    ['yes', 'Yes'],
    ['no', 'No'],
    ['unsure', 'Not sure'],
  ];
  const head = (
    <View style={s.checkHead}>
      <Text style={s.checkLabel}>{lisa ? 'Label check' : 'Please check'}</Text>
      {start !== undefined && <HearButton at={start} onHear={onHear} />}
    </View>
  );

  // Medicine checks are Mary's to answer; Lisa sees where things stand.
  if (lisa)
    return (
      <View style={s.check}>
        {head}
        <Text style={s.checkQuestion}>{name}</Text>
        <Text style={ui.body}>{answer ? `Mary said: ${choices.find(([v]) => v === answer)![1]}` : 'Mary hasn’t answered yet.'}</Text>
        {(answer === 'no' || answer === 'unsure') && (
          <Text style={[ui.body, { fontWeight: '700' }]}>Mary should check with her pharmacist before changing anything.</Text>
        )}
      </View>
    );

  return (
    <View style={s.check}>
      {head}
      <Text style={s.checkQuestion}>Does your label say {name}?</Text>
      <View style={[s.row, { gap: 8, marginTop: 4 }]}>
        {choices.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => choose(value)}
            style={[s.choice, answer === value && s.choiceOn]}
            accessibilityRole="radio"
            aria-checked={answer === value}>
            <Text style={[s.choiceText, answer === value && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {answer === 'yes' && <Text style={[ui.body, { color: colors.green, fontWeight: '600' }]}>Saved.</Text>}
      {(answer === 'no' || answer === 'unsure') && (
        <Text style={[ui.body, { fontWeight: '700' }]}>Please check with your pharmacist before changing anything.</Text>
      )}
      {failed && <Text style={[ui.body, { color: colors.accent }]}>Not saved. Please try again.</Text>}
    </View>
  );
}

type GroupItem = { id: string; main: string; sub?: string | null; bold?: boolean; number?: number; flag?: boolean; now?: boolean; start?: number };

const COLLAPSED = 3;

/** A labelled list of short items. Hidden when empty; long lists start collapsed. */
function Group({ title, items, onHear }: { title: string; items: GroupItem[]; onHear: (seconds: number) => void }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, COLLAPSED);
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[s.section, { marginBottom: 8 }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={s.list}>
        {shown.map((item, i) => (
          <View key={item.id} style={[s.item, i > 0 && s.divider]}>
            {item.number ? <Text style={[s.num, item.flag && s.numFlag, item.now && s.numNow]}>{item.number}</Text> : <View style={s.bullet} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.itemText, !item.bold && s.itemPlain]}>{item.main}</Text>
              {item.sub && <Text style={s.itemSub}>{item.sub}</Text>}
              {/* Long sentences keep the full width; the time goes under them. */}
              {!item.bold && item.start !== undefined && (
                <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  <HearButton at={item.start} onHear={onHear} />
                </View>
              )}
            </View>
            {item.bold && item.start !== undefined && <HearButton at={item.start} onHear={onHear} />}
          </View>
        ))}
        {items.length > COLLAPSED && (
          <Pressable onPress={() => setAll(!all)} style={[s.more, s.divider]} accessibilityRole="button">
            <Text style={s.moreText}>{all ? 'Show less' : `Show all ${items.length}`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HearButton({ at, onHear }: { at: number; onHear: (seconds: number) => void }) {
  return (
    <Pressable onPress={() => onHear(at)} style={s.hear} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Hear it, at ${clock(at)}`}>
      <Ionicons name="play" size={12} color={colors.accentDark} />
      <Text style={s.hearText}>{clock(at)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.6, color: colors.text, marginTop: 2 },
  meta: { fontSize: 15.5, color: colors.muted, marginTop: -4 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#f1ece8' },
  check: {
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    marginTop: 4,
  },
  checkHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  checkLabel: { fontSize: 13.5, fontWeight: '800', color: colors.amber },
  checkQuestion: { fontSize: 16.5, lineHeight: 22, fontWeight: '700', color: colors.text },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5cb90',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { fontSize: 15.5, fontWeight: '700', color: '#6e4a14' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text },
  ai: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c6a5e',
    backgroundColor: '#efe5dd',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  para: { fontSize: 16, lineHeight: 24, color: colors.body },
  list: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: '#f0e8e1' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  itemText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  itemPlain: { fontWeight: '400', color: colors.body },
  itemSub: { fontSize: 14, lineHeight: 19, color: colors.muted },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d9b8a8', marginHorizontal: 4 },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: '#f2e6de',
    color: colors.accentDark,
    fontWeight: '800',
    fontSize: 14,
    overflow: 'hidden',
  },
  numFlag: { backgroundColor: '#d99428', color: '#fff' },
  numNow: { backgroundColor: colors.accent, color: '#fff' },
  more: { minHeight: 46, justifyContent: 'center' },
  moreText: { fontSize: 15.5, color: colors.accent, fontWeight: '700' },
  hear: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 32, borderRadius: 10, backgroundColor: colors.accentSoft },
  hearText: { fontSize: 14, color: colors.accentDark, fontWeight: '700', fontVariant: ['tabular-nums'] },
  fold: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9 },
  lineTime: { minWidth: 46, paddingTop: 2 },
  timeText: { fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  lineText: { flex: 1, fontSize: 15.5, lineHeight: 22, color: colors.body },
  player: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: '#26211e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 6,
    shadowColor: '#1e140f',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  playerTitle: { flex: 1, fontSize: 15.5, fontWeight: '600', color: '#fff' },
  playerTime: { fontSize: 13.5, color: '#cfc6bf', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: '#5a514b', marginTop: 18, marginBottom: 14, marginHorizontal: 9 },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: '#ff6a4f' },
  marker: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: '#6d625b',
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '800',
    overflow: 'hidden',
  },
  markerFlag: { backgroundColor: '#e0a23a' },
  markerNow: { backgroundColor: '#fff', color: '#26211e' },
});
