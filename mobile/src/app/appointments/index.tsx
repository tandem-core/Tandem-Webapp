import { RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHome } from '@/api';
import { sharesAnything, useDemo } from '@/demo';
import { isNewForLisa } from '@/format';
import { AppointmentCard, LoadState, styles } from '@/ui';

export default function Appointments() {
  const { data, error, loading, reload } = useHome();
  const { viewer, sharing, sharingSince, seen } = useDemo();
  const lisa = viewer === 'lisa';
  const hidden = lisa && !sharesAnything(sharing);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          {lisa ? 'Mary’s appointments' : 'Appointments'}
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data && hidden && <Text style={styles.muted}>Mary hasn’t shared anything yet.</Text>}
        {!hidden &&
          data?.visits.map((v) => <AppointmentCard key={v.slug} visit={v} lisa={lisa} isNew={lisa && isNewForLisa(v, sharingSince, seen)} />)}
      </ScrollView>
    </SafeAreaView>
  );
}
