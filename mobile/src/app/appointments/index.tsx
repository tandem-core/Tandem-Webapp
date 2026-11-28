import { RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHome } from '@/api';
import { dockSpace } from '@/theme';
import { LoadState, styles, VisitRow } from '@/ui';

export default function Appointments() {
  const { data, error, loading, reload } = useHome();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: dockSpace }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={[styles.display, { marginBottom: 4 }]} accessibilityRole="header">
          Appointments
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data?.visits.map((v) => (
          <VisitRow key={v.slug} visit={v} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
