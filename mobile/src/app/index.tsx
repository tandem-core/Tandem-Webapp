import { Link } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHome, useLoad } from '@/api';
import { useDemo } from '@/demo';
import { colors } from '@/theme';
import { AppointmentCard, LoadState, styles, ViewerSwitch } from '@/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

export default function Home() {
  const { data, error, loading, reload } = useLoad(getHome);
  const { viewer, shared } = useDemo();
  const lisa = viewer === 'lisa';
  const visits = (data?.visits ?? []).filter((v) => !lisa || shared.includes(v.slug));
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
        <Text style={styles.heading}>{lisa ? 'Shared by Mary' : 'Recent appointments'}</Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {visits.slice(0, 2).map((v) => (
          <AppointmentCard key={v.slug} visit={v} />
        ))}
        {data && lisa && visits.length === 0 && <Text style={styles.muted}>Nothing shared yet.</Text>}
        {data && (
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
