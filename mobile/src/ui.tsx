import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { VisitSummary } from '@/api';
import { dateParts } from '@/format';
import { colors, text, touch } from '@/theme';

export function AppointmentCard({ visit }: { visit: VisitSummary }) {
  const { month, day, weekday } = dateParts(visit.recordedAt);
  return (
    <Link href={`/appointments/${visit.slug}`} asChild>
      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${visit.title}, ${weekday} ${month} ${day}${visit.medicationsToCheck ? ', something to check' : ''}`}>
        <View style={styles.tile}>
          <Text style={styles.tileMonth}>{month.slice(0, 3).toUpperCase()}</Text>
          <Text style={styles.tileDay}>{day}</Text>
          <Text style={styles.tileWeekday}>{weekday.slice(0, 3)}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title}>{visit.title}</Text>
          {visit.medicationsToCheck > 0 && (
            <View style={styles.flag}>
              <Ionicons name="alert-circle" size={20} color={colors.amber} />
              <Text style={styles.flagText}>Something to check</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={26} color={colors.muted} />
      </Pressable>
    </Link>
  );
}

/** Loading spinner or error with a retry button. Renders nothing once loaded. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.body}>{error}</Text>
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  if (loading) return <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />;
  return null;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  pageTitle: { fontSize: text.title, fontWeight: '700', color: colors.text, marginTop: 8 },
  heading: { fontSize: text.heading, fontWeight: '700', color: colors.text, marginTop: 12 },
  body: { fontSize: text.body, color: colors.text, lineHeight: 28 },
  muted: { fontSize: text.small, color: colors.muted, lineHeight: 24 },
  center: { padding: 24, gap: 16, alignItems: 'center' },
  button: {
    minHeight: touch,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: text.body, fontWeight: '700', color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tile: { width: 68, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tileMonth: {
    alignSelf: 'stretch',
    textAlign: 'center',
    backgroundColor: colors.accent,
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    paddingVertical: 2,
  },
  tileDay: { fontSize: 30, fontWeight: '800', color: colors.text },
  tileWeekday: { fontSize: 15, color: colors.muted, paddingBottom: 4 },
  title: { fontSize: text.body, fontWeight: '700', color: colors.text },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  flagText: { fontSize: text.small, color: colors.amber, fontWeight: '600' },
});
