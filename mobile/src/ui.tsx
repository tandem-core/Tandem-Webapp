import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Answer, answerMedication, Medication, VisitSummary } from '@/api';
import { setViewer, useDemo, Viewer } from '@/demo';
import { clock, dateParts, doseOf } from '@/format';
import { colors, fonts, radius, touch } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'forest',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'forest' | 'coral' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
}) {
  const ink = kind === 'ghost' ? colors.forest : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, styles[kind], disabled && { opacity: 0.5 }, pressed && styles.pressed]}
      accessibilityRole="button">
      {icon && <Ionicons name={icon} size={20} color={ink} />}
      <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.forest} />
    </Pressable>
  );
}

/** Back button with an optional centered title, for screens opened over the dock. home always returns to Home. */
export function Header({ title, fallback = '/', home = false }: { title?: string; fallback?: '/' | '/appointments'; home?: boolean }) {
  return (
    <View style={styles.header}>
      <IconButton
        icon="arrow-back"
        label="Back"
        onPress={() => (home ? router.navigate('/') : router.canGoBack() ? router.back() : router.replace(fallback))}
      />
      {title ? (
        <Text style={[styles.head, styles.headerTitle]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <View style={{ width: 46 }} />
    </View>
  );
}

export function DateTile({ iso }: { iso: string }) {
  const { month, day } = dateParts(iso);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileMonth}>{month.slice(0, 3)}</Text>
      <Text style={styles.tileDay}>{day}</Text>
    </View>
  );
}

/** One appointment in a list. Lisa sees "New" instead of Mary's check flag. */
export function VisitRow({ visit, lisa = false, isNew = false, note }: { visit: VisitSummary; lisa?: boolean; isNew?: boolean; note?: string }) {
  const { month, day, weekday } = dateParts(visit.recordedAt);
  const checks = lisa ? 0 : visit.medicationsToCheck;
  const sub = isNew ? 'New' : checks ? 'Check your bottle' : note;
  return (
    <Link href={`/appointments/${visit.slug}`} asChild>
      <Pressable
        // One object, not an array: Link passes it to the web element as-is.
        style={StyleSheet.flatten([styles.card, styles.row, isNew && { borderColor: colors.coral }])}
        accessibilityRole="button"
        accessibilityLabel={`${isNew ? 'New: ' : ''}${visit.title}, ${weekday} ${month} ${day}${checks ? `, ${checks} to check` : ''}`}>
        <DateTile iso={visit.recordedAt} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.head}>{visit.title}</Text>
          {sub ? (
            <Text style={[styles.muted, isNew && { color: colors.coralDeep, fontFamily: fonts.semibold }, checks > 0 && !isNew && { color: colors.amberInk }]}>
              {sub}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

export function HearButton({ at, onPress, solid = false, playing = false }: { at?: number; onPress: () => void; solid?: boolean; playing?: boolean }) {
  const ink = solid || playing ? '#fff' : colors.forest;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.hear, solid ? styles.forest : styles.hearSubtle, playing && styles.hearPlaying, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={at === undefined ? 'Hear it' : `Hear it, at ${clock(at)}`}>
      <Ionicons name={playing ? 'pause' : 'play'} size={16} color={ink} />
      <Text style={[styles.hearText, { color: ink }]}>{at === undefined ? 'Hear it' : `Hear it · ${clock(at)}`}</Text>
    </Pressable>
  );
}

const BARS = [11, 22, 15, 24, 13];
const BARS_LARGE = [18, 40, 26, 52, 30, 42, 20];

/** Bars that move while something is playing or recording. */
export function Wave({ color = colors.forest, large = false }: { color?: string; large?: boolean }) {
  const heights = large ? BARS_LARGE : BARS;
  const [values] = useState(() => heights.map(() => new Animated.Value(0.5)));
  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * 160) % 420),
          Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(v, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [values]);
  return (
    <View style={[styles.wave, large && { height: 52, gap: 8 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {heights.map((h, i) => (
        <Animated.View key={i} style={{ width: large ? 6 : 4, height: h, borderRadius: 99, backgroundColor: color, transform: [{ scaleY: values[i] }] }} />
      ))}
    </View>
  );
}

/** Something Mary didn't share, in Lisa's view. */
export function Locked({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.locked}>
      <View style={styles.lockBadge}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { fontFamily: fonts.semibold }]}>{title}</Text>
        <Text style={styles.muted}>{note}</Text>
      </View>
    </View>
  );
}

const CHOICES: [Answer, string][] = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['unsure', 'Not sure'],
];

/** "Bottle says lansoprazole 15 mg?" Mary answers; Lisa sees where it stands. */
export function LabelCheck({ slug, med, lisa = false, hear }: { slug: string; med: Medication; lisa?: boolean; hear?: ReactNode }) {
  const [answer, setAnswer] = useState(med.ownerAnswer?.answer ?? null);
  const [failed, setFailed] = useState(false);
  const dose = doseOf(med);
  const name = `${med.suggestion?.name}${dose ? ` ${dose}` : ''}`;
  const choose = (next: Answer) => {
    const before = answer;
    setAnswer(next);
    setFailed(false);
    answerMedication(slug, med.id, next).catch(() => {
      setAnswer(before);
      setFailed(true);
    });
  };
  const worry = answer === 'no' || answer === 'unsure';
  return (
    <View style={styles.amber}>
      <Text style={styles.amberTitle}>{lisa ? name.charAt(0).toUpperCase() + name.slice(1) : `Bottle says ${name}?`}</Text>
      {hear}
      {lisa ? (
        <Text style={styles.body}>{answer ? `Mary: ${CHOICES.find(([v]) => v === answer)![1]}` : 'Not checked yet'}</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CHOICES.map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => choose(value)}
              style={[styles.amberOption, value === 'unsure' && { flex: 1.38 }, answer === value && styles.amberChosen]}
              accessibilityRole="radio"
              aria-checked={answer === value}>
              <Text style={[styles.body, { fontFamily: fonts.semibold }, answer === value && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {answer === 'yes' && !lisa && <Text style={[styles.body, { color: colors.forest }]}>Saved.</Text>}
      {worry && (
        <Text style={[styles.body, { fontFamily: fonts.semibold, color: colors.amberInk }]}>
          {lisa ? 'Mary should ask her pharmacist first.' : 'Ask your pharmacist before changing anything.'}
        </Text>
      )}
      {failed && <Text style={[styles.body, { color: colors.coralDeep }]}>Not saved. Try again.</Text>}
    </View>
  );
}

const PEOPLE: [Viewer, string][] = [
  ['mary', 'Mary'],
  ['lisa', 'Lisa'],
];

/** Demo switch between Mary's app and Lisa's caregiver view. */
export function ViewerSwitch() {
  const { viewer } = useDemo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="person-circle-outline" label="Switch person" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <View style={styles.sheet}>
            {PEOPLE.map(([id, name]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setViewer(id);
                  setOpen(false);
                }}
                style={[styles.card, styles.row, { minHeight: 64 }]}
                accessibilityRole="radio"
                aria-checked={viewer === id}>
                <Text style={[styles.head, { flex: 1 }]}>{name}</Text>
                {viewer === id && <Ionicons name="checkmark" size={24} color={colors.forest} />}
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
        <Button label="Try again" onPress={onRetry} />
      </View>
    );
  if (loading) return <ActivityIndicator size="large" color={colors.forest} style={{ marginTop: 40 }} />;
  return null;
}

const shadow = '0 8px 22px rgba(23, 75, 60, 0.05)';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  display: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, color: colors.forest },
  head: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 25, color: colors.forest },
  body: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 25, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, color: colors.muted },
  section: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 8, marginBottom: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  center: { padding: 24, gap: 14, alignItems: 'center' },
  pressed: { transform: [{ scale: 0.98 }] },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    ...radius.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    boxShadow: shadow,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  button: { minHeight: touch, paddingHorizontal: 18, ...radius.button, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  forest: { backgroundColor: colors.forest },
  coral: { backgroundColor: colors.coral, minHeight: 54 },
  ghost: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  buttonText: { fontFamily: fonts.semibold, fontSize: 17 },
  iconButton: {
    width: 46,
    height: 46,
    ...radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { flex: 1, textAlign: 'center' },
  tile: {
    width: 66,
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMonth: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  tileDay: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.forest },
  hear: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, ...radius.button, alignSelf: 'flex-start' },
  hearSubtle: { backgroundColor: colors.canvas, borderWidth: 1.5, borderColor: colors.line },
  hearPlaying: { backgroundColor: colors.coral, borderColor: colors.coral },
  hearText: { fontFamily: fonts.semibold, fontSize: 16 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24 },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D8C9B7',
    ...radius.card,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amber: { backgroundColor: colors.amberBg, borderWidth: 1.5, borderColor: colors.amberLine, ...radius.card, padding: 18, gap: 12 },
  amberTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.amberInk },
  amberOption: {
    flex: 1,
    minHeight: 46,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#D9B45D',
    ...radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  amberChosen: { backgroundColor: colors.forest, borderColor: colors.forest },
  scrim: { flex: 1, backgroundColor: 'rgba(28,48,38,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32, gap: 10 },
});
