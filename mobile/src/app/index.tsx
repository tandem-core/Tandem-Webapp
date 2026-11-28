import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHome, getVisit, useAllVisits, useLoad } from '@/api';
import { NOTHING, setPerson, sharesAnything, useDemo } from '@/demo';
import { aboutMary, brief, dateParts, isNewForLisa, shortDate } from '@/format';
import { colors, dockSpace, fonts } from '@/theme';
import { Card, IconButton, LoadState, Locked, styles, ViewerSwitch, VisitRow } from '@/ui';

export default function Home() {
  const { viewer } = useDemo();
  return viewer === 'lisa' ? <LisaHome /> : <MaryHome />;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// The newest appointment, plus the full appointment that has the next open to-do.
async function loadHome() {
  const home = await getHome();
  const withTodo = home.visits.find((v) => v.todoCount > 0);
  return { home, todoVisit: withTodo ? await getVisit(withTodo.slug) : null };
}

function MaryHome() {
  const { data, error, loading, reload } = useLoad(loadHome);
  const { done } = useDemo();
  const latest = data?.home.visits[0];
  const todo = data?.todoVisit?.followUps.find((f) => f.status === 'to_do' && !done.includes(f.id));
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: dockSpace }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <View style={[styles.row, { alignItems: 'flex-start', marginBottom: 4 }]}>
          <View style={[styles.row, { flex: 1, gap: 12 }]}>
            <Image source={require('../../assets/images/teacup.png')} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            <Text style={styles.display} accessibilityRole="header">
              {greeting()},{'\n'}
              {data?.home.owner.name ?? 'Mary'}
            </Text>
          </View>
          <IconButton icon="people-outline" label="Sharing with Lisa" onPress={() => router.push('/sharing')} />
        </View>

        <Pressable
          onPress={() => router.push('/ask')}
          style={({ pressed }) => [s.chat, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Ask me about your visits">
          <View style={[styles.row, { gap: 8 }]}>
            <View style={s.dot} />
            <Text style={[styles.body, { fontSize: 17, color: colors.forest }]}>Ask me about your visits</Text>
          </View>
          <View style={s.field}>
            <Text style={[styles.muted, { flex: 1 }]}>Type or tap mic…</Text>
            <View style={s.mic}>
              <Ionicons name="mic-outline" size={20} color="#fff" />
            </View>
          </View>
        </Pressable>

        <LoadState loading={loading} error={error} onRetry={reload} />
        {latest && (
          <>
            <Text style={styles.section}>Latest appointment</Text>
            <Card onPress={() => router.push(`/appointments/${latest.slug}`)} label={`${latest.title}, ${shortDate(latest.recordedAt)}`}>
              <Text style={styles.head}>{latest.title}</Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {dateParts(latest.recordedAt).weekday} · {shortDate(latest.recordedAt)}
              </Text>
              {latest.headline ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.body}>{brief(latest.headline).short}</Text>
                </>
              ) : null}
            </Card>
          </>
        )}
        {todo && data?.todoVisit && (
          <>
            <Text style={styles.section}>To do</Text>
            <Card onPress={() => router.push('/todos')} label={`To do: ${todo.title}`} style={{ paddingVertical: 16, paddingHorizontal: 18 }}>
              <View style={[styles.row, { alignItems: 'flex-start', gap: 14 }]}>
                <View style={s.box} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.body}>{todo.title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {data.todoVisit.title} · {shortDate(data.todoVisit.recordedAt)}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PART_NAMES = { summary: 'Summary', transcript: 'Transcript', recording: 'Recording' } as const;

function LisaHome() {
  const { data, error, loading, reload } = useAllVisits();
  const { person, sharing, sharingSince, seen } = useDemo();
  const parts = sharing ?? NOTHING;
  const visits = data ?? [];
  const isNew = (v: (typeof visits)[number]) => isNewForLisa(v, sharingSince, seen);
  // The newest shared visit leads, marked New only if Lisa hasn't seen it.
  const lead = visits.find(isNew) ?? visits[0];
  const rest = visits.filter((v) => v !== lead);
  const asks = visits.flatMap((v) => v.followUps.filter((f) => f.request && f.request.status !== 'done').map((f) => ({ ...f, slug: v.slug })));
  const notShared = (Object.keys(PART_NAMES) as (keyof typeof PART_NAMES)[]).filter((p) => !parts[p]).map((p) => PART_NAMES[p]);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 }]} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <View style={styles.row}>
          <Text style={[styles.display, { flex: 1 }]} accessibilityRole="header">
            Hi Lisa
          </Text>
          <ViewerSwitch />
        </View>
        <View style={s.switch} accessibilityRole="tablist">
          {(
            [
              ['mary', 'Mary'],
              ['arthur', 'Dad (Arthur)'],
            ] as const
          ).map(([id, name]) => (
            <Pressable
              key={id}
              onPress={() => setPerson(id)}
              style={[s.person, person === id && { backgroundColor: colors.forest }]}
              accessibilityRole="tab"
              aria-selected={person === id}>
              <Text style={[s.personText, person === id && { color: '#fff' }]}>{name}</Text>
            </Pressable>
          ))}
        </View>

        {person === 'arthur' ? (
          <Locked title="Nothing shared yet" note="Arthur chooses what you see" />
        ) : !sharesAnything(sharing) ? (
          <Locked title="Nothing shared yet" note="Mary chooses what you see" />
        ) : (
          <>
            <LoadState loading={loading} error={error} onRetry={reload} />
            {asks.map((a) => (
              <Card
                key={a.id}
                onPress={() => router.push(`/appointments/${a.slug}`)}
                style={{ borderColor: colors.forest }}
                label={`Help request from Mary: ${a.title}`}>
                <Text style={[styles.section, { color: colors.forest, marginTop: 0, marginBottom: 4 }]}>Help request from Mary</Text>
                <Text style={styles.body}>{a.title}</Text>
              </Card>
            ))}
            {lead && (
              <Pressable
                onPress={() => router.push(`/appointments/${lead.slug}`)}
                style={({ pressed }) => [s.hero, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${isNew(lead) ? 'New: ' : ''}${lead.title}`}>
                <View style={s.heroTop}>
                  {isNew(lead) && <Text style={s.newTag}>New</Text>}
                  <Text style={s.heroTitle}>{lead.title}</Text>
                  <Text style={s.heroDate}>{shortDate(lead.recordedAt)}</Text>
                </View>
                {parts.summary && lead.headline ? (
                  <View style={{ paddingVertical: 16, paddingHorizontal: 20 }}>
                    <Text style={styles.body}>{aboutMary(brief(lead.headline).short)}</Text>
                  </View>
                ) : null}
              </Pressable>
            )}
            {notShared.length > 0 && data && <Locked title={notShared.join(' & ')} note="Not shared by Mary" />}
            {rest.map((v) => (
              <VisitRow key={v.slug} visit={v} lisa isNew={isNew(v)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chat: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#DFCCB6',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 22,
    padding: 14,
    paddingLeft: 18,
    gap: 10,
    boxShadow: '0 8px 24px rgba(23, 75, 60, 0.06)',
    marginBottom: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.forest },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 6,
    paddingLeft: 14,
  },
  mic: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  box: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: colors.forest, marginTop: 2 },
  switch: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    marginBottom: 4,
  },
  person: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  personText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.muted },
  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 10px 26px rgba(172, 62, 36, 0.09)',
  },
  heroTop: { backgroundColor: colors.coral, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'flex-start' },
  newTag: {
    backgroundColor: '#fff',
    color: colors.coralDeep,
    fontFamily: fonts.bold,
    fontSize: 14,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, color: '#fff' },
  heroDate: { fontFamily: fonts.regular, fontSize: 17, color: '#FFE7DF', marginTop: 4 },
});
