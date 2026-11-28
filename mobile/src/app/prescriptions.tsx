import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMeds, useLoad } from '@/api';
import { amountOf, isLabelCheck, shortDate } from '@/format';
import { dockSpace } from '@/theme';
import { Card, LabelCheck, LoadState, styles } from '@/ui';

const CHANGE: Record<string, string> = { started: 'Started', changed: 'Changed', existing: 'Unchanged' };
// null when this server has no running list yet (only the testing track has /api/meds).
const loadMeds = () => getMeds().catch(() => null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// The list marks names the recording didn't make clear as "heard" (name unclear).
const unclear = (name: string) => name.match(/^"(.+)" \(name unclear\)$/)?.[1];

export default function Meds() {
  const { data, error, loading, reload } = useLoad(loadMeds);
  const checks = data?.checks.filter((c) => isLabelCheck(c.med) && c.med.ownerAnswer?.answer !== 'yes') ?? [];
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: dockSpace }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={[styles.display, { marginBottom: 4 }]} accessibilityRole="header">
          Prescriptions
        </Text>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data === null && !loading && <Text style={styles.muted}>Your medicine list will appear here.</Text>}
        {checks.map((c) => (
          <LabelCheck key={`${c.slug}:${c.med.id}`} slug={c.slug} med={c.med} />
        ))}
        {data?.current.map((e) => {
          const amount = e.dose && amountOf(e.dose);
          const heard = unclear(e.medicine);
          return (
            <Card key={e.medicine} onPress={() => router.push(`/appointments/${e.slug}`)} label={`${e.medicine}, from ${e.title}`}>
              <Text style={styles.head}>
                {heard ? `“${cap(heard)}”` : cap(e.medicine)}
                {amount ? ` ${amount}` : ''}
              </Text>
              {e.dose ? <Text style={[styles.body, { marginTop: 4 }]}>{cap(e.dose)}</Text> : null}
              <View style={{ marginTop: 6 }}>
                <Text style={styles.muted}>
                  {heard ? 'Name unclear · ' : ''}
                  {CHANGE[e.change] ?? cap(e.change)} {shortDate(`${e.date}T12:00`)} · {e.title}
                </Text>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
