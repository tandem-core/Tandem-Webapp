import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Answer, answerMedication, API_URL, getVisit, Medication, useLoad, Visit } from '@/api';
import { markSeen, NOTHING, Parts, sharesAnything, useDemo } from '@/demo';
import { aboutMary, checkReason, clock, dateParts, doseOf, labelChecks, markerPositions, otherChecks } from '@/format';
import { colors, text, touch } from '@/theme';
import { LoadState, styles as ui } from '@/ui';

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
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/appointments'))}
        style={s.back}
        accessibilityRole="button"
        accessibilityLabel="Back to appointments">
        <Ionicons name="chevron-back" size={28} color={colors.accent} />
        <Text style={s.backText}>Appointments</Text>
      </Pressable>
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
  const markers = markerPositions(moments.map((m) => m.start), length);
  const current = status.currentTime > 0 ? moments.findLast((m) => m.start <= status.currentTime + 0.5) : undefined;
  const { month, day } = dateParts(visit.recordedAt);
  const notShared = (['summary', 'transcript', 'recording'] as const).filter((p) => !parts[p]);

  const playAt = (seconds: number) => {
    player.seekTo(seconds);
    player.play();
  };

  return (
    <>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.pageTitle} accessibilityRole="header">
          {visit.title}
        </Text>
        <Text style={ui.muted}>
          {month.slice(0, 3)} {day}
        </Text>
        {lisa && notShared.length > 0 && (
          <View style={[s.row, s.note]}>
            <Ionicons name="lock-closed" size={20} color={colors.muted} />
            <Text style={[ui.muted, { flex: 1 }]}>Mary didn’t share the {notShared.join(' or ')}.</Text>
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
                  <View style={[s.row, { alignItems: 'flex-start' }]}>
                    <Text style={[ui.body, { fontWeight: '700', flex: 1 }]}>{checkReason(med)}</Text>
                    {start !== undefined && <HearButton at={start} onHear={playAt} />}
                  </View>
                  <Text style={ui.body}>{lisa ? 'Mary should ask her pharmacist before changing anything.' : 'Ask your pharmacist before changing anything.'}</Text>
                </View>
              );
            })}

            <View style={s.row}>
              <Text style={ui.heading}>Summary</Text>
              <Text style={s.aiBadge}>{visit.reviewed ? 'AI-generated' : 'AI-generated · not reviewed'}</Text>
            </View>
            <Text style={s.headline}>{say(visit.headline ?? '')}</Text>

            <Group
              title="What to do"
              items={[
                ...moments.map((m, i) => ({ id: m.id, main: say(m.title), sub: m.when, bold: true, number: i + 1, flag: m.uncheckedMedication, now: current?.id === m.id, start: m.start })),
                ...visit.followUps
                  .filter((f) => !moments.some((m) => m.id === f.id))
                  .map((f) => ({ id: f.id, main: say(f.title), sub: f.when, bold: true })),
              ]}
              onHear={playAt}
            />
            <Group title={lisa ? 'What Mary was told' : 'What you were told'} items={visit.instructions.map((i) => ({ id: i.id, main: say(i.text), start: at(i.evidence) }))} onHear={playAt} />
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
              <Ionicons name={status.playing ? 'pause' : 'play'} size={30} color="#fff" />
            </Pressable>
            <Text style={[ui.body, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>
              {!status.isLoaded ? 'Loading…' : current ? `${moments.indexOf(current) + 1} · ${say(current.title)}` : 'Recording'}
            </Text>
            <Text style={s.time}>
              {clock(status.currentTime)} / {clock(length)}
            </Text>
          </View>
          <View style={s.track}>
            <View style={[s.trackFill, { width: `${length ? (status.currentTime / length) * 100 : 0}%` }]} />
            {length > 0 &&
              moments.map((m, i) => (
                <Text key={m.id} style={[s.marker, m.uncheckedMedication && s.numFlag, { left: `${markers[i]}%` }]}>
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
    <View style={s.group}>
      <Pressable onPress={() => setOpen(!open)} style={[s.row, { minHeight: touch }]} accessibilityRole="button" aria-expanded={open}>
        <Text style={[s.groupTitle, { flex: 1, marginBottom: 0 }]}>Transcript</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={26} color={colors.muted} />
      </Pressable>
      {open &&
        segments.map((seg) => (
          <View key={seg.idx} style={[s.row, { alignItems: 'flex-start', paddingVertical: 6 }]}>
            {onHear ? (
              <Pressable onPress={() => onHear(seg.start)} style={{ minWidth: 56, minHeight: 40 }} accessibilityRole="button" accessibilityLabel={`Hear it, at ${clock(seg.start)}`}>
                <Text style={s.hearText}>{clock(seg.start)}</Text>
              </Pressable>
            ) : (
              <Text style={[s.time, { minWidth: 56 }]}>{clock(seg.start)}</Text>
            )}
            <Text style={[ui.body, { flex: 1 }]}>{seg.text}</Text>
          </View>
        ))}
    </View>
  );
}

function LabelCheck({ slug, med, lisa, start, onHear }: { slug: string; med: Medication; lisa: boolean; start?: number; onHear: (seconds: number) => void }) {
  const [answer, setAnswer] = useState(med.ownerAnswer?.answer ?? null);
  const [failed, setFailed] = useState(false);
  const dose = doseOf(med);

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

  // Medicine checks are Mary's to answer; Lisa sees where things stand.
  if (lisa)
    return (
      <View style={s.check}>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <Text style={[ui.heading, { marginTop: 0, flex: 1 }]}>
            Label check: {med.suggestion?.name}
            {dose ? ` ${dose}` : ''}
          </Text>
          {start !== undefined && <HearButton at={start} onHear={onHear} />}
        </View>
        <Text style={ui.body}>{answer ? `Mary said: ${choices.find(([v]) => v === answer)![1]}` : 'Mary hasn’t answered yet.'}</Text>
        {(answer === 'no' || answer === 'unsure') && (
          <Text style={[ui.body, { fontWeight: '700' }]}>Mary should check with her pharmacist before changing anything.</Text>
        )}
      </View>
    );

  return (
    <View style={s.check}>
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <Text style={[ui.heading, { marginTop: 0, flex: 1 }]}>
          Does your label say {med.suggestion?.name}
          {dose ? ` ${dose}` : ''}?
        </Text>
        {start !== undefined && <HearButton at={start} onHear={onHear} />}
      </View>
      <View style={s.row}>
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
      {answer === 'yes' && <Text style={[ui.body, { color: colors.green }]}>Saved.</Text>}
      {(answer === 'no' || answer === 'unsure') && (
        <Text style={[ui.body, { fontWeight: '700' }]}>Please check with your pharmacist before changing anything.</Text>
      )}
      {failed && <Text style={[ui.body, { color: colors.accent }]}>Not saved. Please try again.</Text>}
    </View>
  );
}

type GroupItem = {
  id: string;
  main: string;
  sub?: string | null;
  bold?: boolean;
  number?: number;
  flag?: boolean;
  now?: boolean;
  start?: number;
};

const COLLAPSED = 3;

/** A labelled group of short items. Hidden when empty; long groups start collapsed. */
function Group({ title, items, onHear }: { title: string; items: GroupItem[]; onHear: (seconds: number) => void }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, COLLAPSED);
  return (
    <View style={s.group}>
      <Text style={s.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      {shown.map((item) => (
        <View key={item.id} style={[s.item, item.now && s.itemNow]}>
          {item.number ? (
            <Text style={[s.num, item.flag && s.numFlag]}>{item.number}</Text>
          ) : (
            <View style={s.bullet} />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[ui.body, item.bold && { fontWeight: '700' }]}>{item.main}</Text>
            {item.sub && <Text style={ui.muted}>{item.sub}</Text>}
            {item.start !== undefined && <HearButton at={item.start} onHear={onHear} />}
          </View>
        </View>
      ))}
      {items.length > COLLAPSED && (
        <Pressable onPress={() => setAll(!all)} style={s.link} accessibilityRole="button">
          <Text style={s.linkText}>{all ? 'Show less' : 'Show all'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function HearButton({ at, onHear }: { at: number; onHear: (seconds: number) => void }) {
  return (
    <Pressable onPress={() => onHear(at)} style={s.hear} accessibilityRole="button" accessibilityLabel={`Hear it, at ${clock(at)}`}>
      <Ionicons name="play" size={18} color={colors.accent} />
      <Text style={s.hearText}>{clock(at)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', minHeight: touch, paddingHorizontal: 12 },
  backText: { fontSize: text.body, color: colors.accent, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { gap: 8, paddingVertical: 4 },
  aiBadge: { marginTop: 14, fontSize: 15, color: colors.muted },
  link: { minHeight: touch, justifyContent: 'center' },
  linkText: { fontSize: text.body, color: colors.accent, fontWeight: '700' },
  check: { backgroundColor: colors.amberSoft, borderRadius: 18, padding: 18, gap: 12 },
  hear: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, minWidth: 48, alignSelf: 'flex-start' },
  choice: {
    flex: 1,
    minHeight: touch,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: colors.accent },
  choiceText: { fontSize: text.body, fontWeight: '700', color: colors.accent },
  headline: { fontSize: 22, lineHeight: 32, fontWeight: '500', color: colors.text },
  group: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4, marginTop: 8 },
  groupTitle: { fontSize: text.heading, fontWeight: '700', color: colors.text, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 10, paddingHorizontal: 4, borderRadius: 12 },
  itemNow: { backgroundColor: colors.accentSoft },
  bullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 10, marginHorizontal: 4 },
  hearText: { fontSize: text.small, color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'] },
  num: {
    width: 34,
    height: 34,
    borderRadius: 17,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 34,
    backgroundColor: colors.text,
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    overflow: 'hidden',
  },
  numFlag: { backgroundColor: colors.amber },
  time: { fontSize: text.small, color: colors.muted, fontVariant: ['tabular-nums'] },
  player: { backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  playButton: { width: touch, height: touch, borderRadius: touch / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginVertical: 12, marginHorizontal: 12 },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  marker: {
    position: 'absolute',
    top: -10,
    width: 28,
    height: 28,
    marginLeft: -14,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: colors.text,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
