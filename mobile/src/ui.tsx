import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { VisitSummary } from '@/api';
import { setViewer, useDemo, Viewer } from '@/demo';
import { aboutMary, dateParts } from '@/format';
import { colors, text, touch } from '@/theme';

function DateTile({ iso }: { iso: string }) {
  const { month, day, weekday } = dateParts(iso);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileMonth}>{month.slice(0, 3).toUpperCase()}</Text>
      <Text style={styles.tileDay}>{day}</Text>
      <Text style={styles.tileWeekday}>{weekday.slice(0, 3)}</Text>
    </View>
  );
}

/** One appointment in a list. Lisa sees "New" instead of Mary's check flag. */
export function AppointmentCard({ visit, lisa = false, isNew = false }: { visit: VisitSummary; lisa?: boolean; isNew?: boolean }) {
  const { month, day, weekday } = dateParts(visit.recordedAt);
  const checks = lisa ? 0 : visit.medicationsToCheck;
  const flag = checks === 1 ? '1 thing to check' : `${checks} things to check`;
  return (
    <Link href={`/appointments/${visit.slug}`} asChild>
      <Pressable
        // One object, not an array: Link passes it to the web element as-is.
        style={StyleSheet.flatten([styles.card, isNew && styles.cardNew])}
        accessibilityRole="button"
        accessibilityLabel={`${isNew ? 'New: ' : ''}${visit.title}, ${weekday} ${month} ${day}${checks ? `, ${flag}` : ''}`}>
        <DateTile iso={visit.recordedAt} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{visit.title}</Text>
          {visit.headline ? (
            <Text style={styles.cardLine} numberOfLines={2}>
              {lisa ? aboutMary(visit.headline) : visit.headline}
            </Text>
          ) : null}
          {(checks > 0 || isNew) && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {isNew && <Text style={[styles.pill, styles.pillNew]}>New</Text>}
              {checks > 0 && (
                <View style={[styles.pill, styles.pillRow]}>
                  <Ionicons name="alert-circle" size={16} color="#d99428" />
                  <Text style={styles.pillAmber}>{flag}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#b3a89f" />
      </Pressable>
    </Link>
  );
}

/** "‹ Label" at the top of a screen opened from somewhere else. */
export function BackButton({ label, fallback }: { label: string; fallback: '/' | '/appointments' }) {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel={label === 'Home' ? 'Back' : `Back to ${label.toLowerCase()}`}>
      <Ionicons name="chevron-back" size={22} color={colors.accent} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
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
            <Text style={[styles.muted, { paddingHorizontal: 4 }]}>Show the app as</Text>
            {PEOPLE.map(([id, name, letter]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setViewer(id);
                  setOpen(false);
                }}
                style={styles.person}
                accessibilityRole="radio"
                aria-checked={viewer === id}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{letter}</Text>
                </View>
                <Text style={[styles.title, { flex: 1 }]}>{name}</Text>
                {viewer === id && <Ionicons name="checkmark" size={24} color={colors.accent} />}
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 10 },
  pageTitle: { fontSize: text.title, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: colors.text, marginTop: 8, marginBottom: 4 },
  heading: { fontSize: text.heading, fontWeight: '800', letterSpacing: -0.3, color: colors.text, marginTop: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  seeAll: { fontSize: 15.5, fontWeight: '700', color: colors.accent, paddingVertical: 6 },
  body: { fontSize: text.body, color: colors.body, lineHeight: 25 },
  muted: { fontSize: text.small, color: colors.muted, lineHeight: 21 },
  center: { padding: 24, gap: 14, alignItems: 'center' },
  button: {
    minHeight: touch,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: text.body, fontWeight: '700', color: '#fff' },
  secondary: { minHeight: touch, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1.5, borderColor: '#e3d2c6', backgroundColor: '#fffdfb', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: text.body, fontWeight: '700', color: colors.accentDark },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 14, alignSelf: 'flex-start' },
  backText: { fontSize: text.body, color: colors.accent, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardNew: { borderColor: colors.accent, borderWidth: 1.5 },
  cardLine: { fontSize: 14.5, lineHeight: 20, color: '#5b524b' },
  tile: {
    width: 58,
    alignSelf: 'flex-start',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e6d3c7',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tileMonth: {
    alignSelf: 'stretch',
    textAlign: 'center',
    backgroundColor: colors.accent,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    paddingTop: 3,
    paddingBottom: 2,
  },
  tileDay: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.text, paddingTop: 4 },
  tileWeekday: { fontSize: 12, fontWeight: '600', color: colors.muted, paddingBottom: 5 },
  title: { fontSize: text.body, lineHeight: 22, fontWeight: '700', color: colors.text },
  pill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
  pillNew: { backgroundColor: colors.accent, color: '#fff' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff0d1', paddingLeft: 4 },
  pillAmber: { fontSize: 13, fontWeight: '700', color: colors.amber },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#efe3da',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.accentDark },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32, gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.card },
});