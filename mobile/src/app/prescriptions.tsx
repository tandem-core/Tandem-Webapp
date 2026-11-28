import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMeds, MedEntry, useLoad } from '@/api';
import { shortDate } from '@/format';
import { dockSpace } from '@/theme';
import { Card, LoadState, MedCheck, styles } from '@/ui';

const CHANGE: Record<string, string> = { started: 'Started', changed: 'Changed', existing: 'Unchanged' };
// null when this server has no running list yet (only the testing track has /api/meds).
const loadMeds = () => getMeds().catch(() => null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The name as heard (in quotes) until it's confirmed, then the server's name for it. */
const nameOf = (e: MedEntry) => (!e.med ? cap(e.medicine) : e.nameUnclear ? `“${cap(e.med.heardAs)}”` : cap(e.med.displayName ?? e.med.heardAs));

export default function Meds() {
  const { data, error, loading, reload } = useLoad(loadMeds);
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
        {data?.current.map((e) => {
          return (
            <View key={e.medicine} style={{ gap: 8 }}>
              <Card onPress={() => router.push(`/appointments/${e.slug}`)} label={`${nameOf(e)}, from ${e.title}`}>
                <Text style={styles.head}>{nameOf(e)}</Text>
                {/* A misheard amount ("100 my grams") is never shown as if it were the dose. */}
                {e.amountUnclear ? (
                  <Text style={[styles.body, { marginTop: 4 }]}>Amount unclear</Text>
                ) : e.dose ? (
                  <Text style={[styles.body, { marginTop: 4 }]}>{cap(e.dose)}</Text>
                ) : null}
                <Text style={[styles.muted, { marginTop: 6 }]}>
                  {e.nameUnclear ? 'Name unclear · ' : ''}
                  {CHANGE[e.change] ?? cap(e.change)} {shortDate(`${e.date}T12:00`)} · {e.title}
                </Text>
              </Card>
              {e.med?.needsReview && <MedCheck slug={e.slug} med={e.med} />}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
