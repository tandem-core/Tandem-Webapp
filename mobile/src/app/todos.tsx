import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clipUrl, useAllVisits, Visit } from '@/api';
import { toggleDone, useDemo } from '@/demo';
import { shortDate } from '@/format';
import { colors, dockSpace } from '@/theme';
import { HearButton, LoadState, styles } from '@/ui';

const HELP: Record<string, string> = { requested: 'Asked Lisa', accepted: 'Lisa is helping', done: 'Lisa did this' };

export default function Todos() {
  const { data, error, loading, reload } = useAllVisits();
  const { done } = useDemo();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState<string | null>(null);
  const now = status.playing ? playing : null;

  // Grouped under the appointment each came from, newest first.
  const groups = (data ?? [])
    .map((visit) => ({
      visit,
      items: visit.followUps.filter((f) => f.status === 'to_do').map((f) => ({ ...f, isDone: done.includes(f.id) || f.request?.status === 'done' })),
    }))
    .filter((g) => g.items.length);
  const hear = (visit: Visit, evidence: number[], id: string) => {
    const lines = visit.segments.filter((seg) => evidence.includes(seg.idx));
    if (!lines.length) return null;
    const url = clipUrl(visit.slug, lines[0].start, lines.at(-1)!.end);
    const toggle = () => {
      if (now === id) return player.pause();
      setPlaying(id);
      player.replace({ uri: url });
      player.play();
    };
    return <HearButton at={lines[0].start} playing={now === id} onPress={toggle} />;
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: dockSpace }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={[styles.display, { marginBottom: 4 }]} accessibilityRole="header">
          To-dos
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data && groups.length === 0 && <Text style={styles.muted}>Nothing to do.</Text>}
        {groups.map(({ visit, items }) => (
          <View key={visit.slug} style={{ gap: 12 }}>
            <Pressable
              onPress={() => router.push(`/appointments/${visit.slug}`)}
              style={s.group}
              accessibilityRole="link"
              accessibilityLabel={`Open ${visit.title}, ${shortDate(visit.recordedAt)}`}>
              <Text style={[styles.section, { marginTop: 0, marginBottom: 0, flexShrink: 1 }]} numberOfLines={1}>
                {visit.title} · {shortDate(visit.recordedAt)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            {items.map((t) => (
              <View key={t.id} style={s.row}>
                <Pressable onPress={() => toggleDone(t.id)} style={s.top} accessibilityRole="checkbox" aria-checked={t.isDone} accessibilityLabel={t.title}>
                  <View style={[s.box, t.isDone && { backgroundColor: colors.forest }]}>
                    {t.isDone && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, t.isDone && s.struck]}>{t.title}</Text>
                    {t.request ? <Text style={styles.muted}>{HELP[t.request.status] ?? ''}</Text> : t.when ? <Text style={styles.muted}>{t.when}</Text> : null}
                  </View>
                </Pressable>
                <View style={{ paddingLeft: 42 }}>{hear(visit, t.evidence, `${visit.slug}:${t.id}`)}</View>
              </View>
            ))}
          </View>
        ))}{' '}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 22,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  box: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: colors.forest, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, marginTop: 6 },
});
