import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { VisitSummary } from '@/api';
import { setViewer, useDemo, Viewer } from '@/demo';
import { dateParts } from '@/format';
import { colors, text, touch } from '@/theme';

function DateTile({ iso }: { iso: string }) {
  const { month, day } = dateParts(iso);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileMonth}>{month.slice(0, 3).toUpperCase()}</Text>
      <Text style={styles.tileDay}>{day}</Text>
    </View>
  );
}

export function AppointmentCard({ visit }: { visit: VisitSummary }) {
  const { month, day, weekday } = dateParts(visit.recordedAt);
  return (
    <Link href={`/appointments/${visit.slug}`} asChild>
      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${visit.title}, ${weekday} ${month} ${day}${visit.medicationsToCheck ? ', something to check' : ''}`}>
        <DateTile iso={visit.recordedAt} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title}>{visit.title}</Text>
          {visit.medicationsToCheck > 0 && (
            <View style={styles.flag}>
              <Ionicons name="alert-circle" size={20} color={colors.amber} />
              <Text style={styles.flagText}>Check</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={26} color={colors.muted} />
      </Pressable>
    </Link>
  );
}

/** An appointment Mary hasn't shared: Lisa sees only its title and date. */
export function NotSharedCard({ visit }: { visit: VisitSummary }) {
  return (
    <View style={[styles.card, { opacity: 0.6 }]} accessible accessibilityLabel={`${visit.title}, not shared`}>
      <DateTile iso={visit.recordedAt} />
      <Text style={[styles.title, { flex: 1 }]}>{visit.title}</Text>
      <Ionicons name="lock-closed" size={24} color={colors.muted} />
    </View>
  );
}

const PEOPLE: [Viewer, string, string][] = [
  ['mary', 'Mary', 'M'],
  ['lisa', 'Lisa', 'L'],
];

/** Demo switch between Mary's own view and Lisa's caregiver view. */
export function ViewerSwitch() {
  const { viewer } = useDemo();
  const [open, setOpen] = useState(false);
  const initial = PEOPLE.find(([id]) => id === viewer)![2];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.avatar} accessibilityRole="button" accessibilityLabel="Switch person">
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={styles.sheet}>
            {PEOPLE.map(([id, name, letter]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setViewer(id);
                  setOpen(false);
                }}
                style={styles.person}
                accessibilityRole="radio"
                accessibilityState={{ selected: viewer === id }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{letter}</Text>
                </View>
                <Text style={[styles.title, { flex: 1 }]}>{name}</Text>
                {viewer === id && <Ionicons name="checkmark" size={28} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
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
  tileDay: { fontSize: 30, fontWeight: '800', color: colors.text, paddingVertical: 4 },
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
  avatar: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: text.heading, fontWeight: '700', color: colors.accent },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 72, paddingHorizontal: 8, borderRadius: 16, backgroundColor: colors.card },
});
