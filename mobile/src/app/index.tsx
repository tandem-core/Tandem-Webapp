import { Link } from 'expo-router';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHome, useLoad } from '@/api';
import { colors } from '@/theme';
import { AppointmentCard, LoadState, styles } from '@/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

export default function Home() {
  const { data, error, loading, reload } = useLoad(getHome);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={styles.muted}>{greeting()}</Text>
        <Text style={[styles.pageTitle, { marginTop: 0 }]} accessibilityRole="header">
          {data?.owner.name ?? ' '}
        </Text>
        <Text style={styles.heading}>Recent appointments</Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data?.visits.slice(0, 2).map((v) => <AppointmentCard key={v.slug} visit={v} />)}
        {data && (
          <Link href="/appointments" style={[styles.body, { color: colors.accent, fontWeight: '700', paddingVertical: 12 }]}>
            See all appointments
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
