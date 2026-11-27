import { RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHome, useLoad } from '@/api';
import { useDemo } from '@/demo';
import { AppointmentCard, LoadState, NotSharedCard, styles } from '@/ui';

export default function Appointments() {
  const { data, error, loading, reload } = useLoad(getHome);
  const { viewer, shared } = useDemo();
  const lisa = viewer === 'lisa';
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          {lisa ? 'Mary’s appointments' : 'Appointments'}
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data?.visits.map((v) =>
          !lisa || shared.includes(v.slug) ? <AppointmentCard key={v.slug} visit={v} /> : <NotSharedCard key={v.slug} visit={v} />,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
