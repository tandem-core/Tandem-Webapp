import { RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHome, useLoad } from '@/api';
import { AppointmentCard, LoadState, styles } from '@/ui';

export default function Appointments() {
  const { data, error, loading, reload } = useLoad(getHome);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          Appointments
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data?.visits.map((v) => <AppointmentCard key={v.slug} visit={v} />)}
      </ScrollView>
    </SafeAreaView>
  );
}
