import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHome } from '@/api';
import { sharesAnything, useDemo } from '@/demo';
import { isNewForLisa, partsLabel } from '@/format';
import { colors } from '@/theme';
import { AppointmentCard, LoadState, styles, ViewerSwitch } from '@/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

export default function Home() {
  const { data, error, loading, reload } = useHome();
  const { viewer, sharing, sharingSince, seen } = useDemo();
  const lisa = viewer === 'lisa';
  const visits = data?.visits ?? [];
  const isNew = (v: (typeof visits)[number]) => lisa && isNewForLisa(v, sharingSince, seen);
  const newCount = visits.filter(isNew).length;
  const shown = lisa && !sharesAnything(sharing) ? [] : visits.slice(0, Math.max(2, newCount));
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>{greeting()}</Text>
            <Text style={s.name} accessibilityRole="header">
              {lisa ? 'Lisa' : (data?.owner.name ?? ' ')}
            </Text>
          </View>
          <ViewerSwitch />
        </View>
        {!lisa && (
          <>
            <Link href="/ask" asChild>
              <Pressable style={s.ask} accessibilityRole="button" accessibilityLabel="Ask about your appointments">
                <Ionicons name="chatbox-outline" size={22} color={colors.accent} />
                <Text style={s.askText} numberOfLines={1}>
                  Ask about your appointments
                </Text>
                <View style={s.mic}>
                  <Ionicons name="mic-outline" size={22} color="#fff" />
                </View>
              </Pressable>
            </Link>
            <Link href="/sharing" asChild>
              <Pressable style={s.row} accessibilityRole="button" accessibilityLabel={sharing ? `Lisa sees: ${partsLabel(sharing)}. Change` : 'Choose what Lisa sees'}>
                <Ionicons name="people-outline" size={22} color={colors.accentDark} />
                <Text style={s.rowText}>{sharing ? `Lisa sees: ${partsLabel(sharing)}` : 'Choose what Lisa sees'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#b3a89f" />
              </Pressable>
            </Link>
          </>
        )}
        <View style={styles.sectionHead}>
          <Text style={[styles.heading, { marginTop: 0 }]}>{lisa ? 'Shared by Mary' : 'Recent appointments'}</Text>
          {shown.length > 0 && (
            <Link href="/appointments" accessibilityLabel="See all appointments" style={styles.seeAll}>
              See all
            </Link>
          )}
        </View>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {shown.map((v) => (
          <AppointmentCard key={v.slug} visit={v} lisa={lisa} isNew={isNew(v)} />
        ))}
        {data && lisa && shown.length === 0 && <Text style={styles.muted}>Mary hasn’t shared anything yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, marginBottom: 6 },
  hello: { fontSize: 17, color: colors.muted, fontWeight: '500' },
  name: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1, color: colors.text },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: '#e3d5ca',
    shadowColor: '#5a371e',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  askText: { flex: 1, fontSize: 16, color: '#8b7f76' },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
});