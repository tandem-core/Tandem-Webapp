import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHome } from '@/api';
import { sharesAnything, useDemo } from '@/demo';
import { isNewForLisa, partsLabel } from '@/format';
import { colors, touch } from '@/theme';
import { AppointmentCard, LoadState, styles, ViewerSwitch } from '@/ui';

const bar: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  minHeight: touch + 8,
  paddingHorizontal: 16,
  borderRadius: 18,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
};

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>{greeting()}</Text>
            <Text style={[styles.pageTitle, { marginTop: 0 }]} accessibilityRole="header">
              {lisa ? 'Lisa' : (data?.owner.name ?? ' ')}
            </Text>
          </View>
          <ViewerSwitch />
        </View>
        {!lisa && (
          <>
            <Link href="/ask" asChild>
              <Pressable style={bar} accessibilityRole="button" accessibilityLabel="Ask about your appointments">
                <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.accent} />
                <Text style={[styles.body, { color: colors.muted, flex: 1 }]}>Ask about your appointments</Text>
              </Pressable>
            </Link>
            <Link href="/sharing" asChild>
              <Pressable style={bar} accessibilityRole="button" accessibilityLabel={sharing ? `Lisa sees: ${partsLabel(sharing)}. Change` : 'Choose what Lisa sees'}>
                <Ionicons name="people-outline" size={26} color={colors.accent} />
                <Text style={[styles.body, { flex: 1 }]}>{sharing ? `Lisa sees: ${partsLabel(sharing)}` : 'Choose what Lisa sees'}</Text>
                <Ionicons name="chevron-forward" size={24} color={colors.muted} />
              </Pressable>
            </Link>
          </>
        )}
        <Text style={styles.heading}>{lisa ? 'Shared by Mary' : 'Recent appointments'}</Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {shown.map((v) => (
          <AppointmentCard key={v.slug} visit={v} lisa={lisa} isNew={isNew(v)} />
        ))}
        {data && lisa && shown.length === 0 && <Text style={styles.muted}>Mary hasn’t shared anything yet.</Text>}
        {shown.length > 0 && (
          <Link
            href="/appointments"
            accessibilityLabel="See all appointments"
            style={[styles.body, { color: colors.accent, fontWeight: '700', paddingVertical: 12 }]}>
            See all
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
