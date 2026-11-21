import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { ReactNode, Ref } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';
import { Aurora } from '@/ui/Aurora';
import { useBottomInset } from '@/ui/FloatingTabBar';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

/** `scrollRef` lets a screen scroll itself (the area timeline's date jump). */
/** `floating` is the one primary action of the screen, drawn above the bottom edge (UX-3). */
export function Screen({ children, scrollRef, floating }: { children: ReactNode; scrollRef?: Ref<ScrollViewInstance>; floating?: ReactNode }) {
  const tabInset = useBottomInset(); // room under the floating tab bar on the tab screens
  const inset = floating ? Math.max(tabInset, 150) : tabInset; // or under the floating action
  return (
  <View style={{ flex: 1, backgroundColor: color.ground }}>
    <Aurora />
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[styles.screen, { paddingBottom: inset }]} contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
    {floating}
  </View>
  );
}

export const Heading = ({ children }: { children: ReactNode }) => (
  <Text style={styles.heading}>{children}</Text>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Hint = ({ children }: { children: ReactNode }) => (
  <Text style={styles.hint}>{children}</Text>
);

const BUTTON_TEXT = { primary: color.onAccent, secondary: color.text, outline: color.accent, danger: color.alert, dangerSolid: color.onAlert } as const;

export function Button({
  title,
  onPress,
  kind = 'primary',
  accessibilityLabel,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerSolid';
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.button, disabled ? styles.disabled : styles[kind], pressed && !disabled && { opacity: 0.7 }]}>
      <Text style={[styles.buttonText, { color: disabled ? color.disabledText : BUTTON_TEXT[kind] }]}>{title}</Text>
    </Pressable>
  );
}

/**
 * One score input for skin scores and Daily health scores (SK-3, SK-7, UX-3):
 * label and value on top, then - / slider (whole steps) / +. With `optional`
 * the value may be null: it shows a dash and a Clear button.
 */
export function ScoreInput({
  label,
  value,
  onChange,
  optional = false,
  hint = null,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  optional?: boolean;
  /** A short description shown under the label (UX-11). */
  hint?: string | null;
}) {
  const set = (v: number) => onChange(Math.min(10, Math.max(0, Math.round(v))));
  return (
    <View style={styles.scoreBox}>
      <View style={styles.scoreHead}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepValue}>{value ?? '–'}</Text>
        {optional ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('common.clear')} ${label}`}
            disabled={value === null}
            onPress={() => onChange(null)}
            style={[styles.clearBtn, value === null && { opacity: 0.3 }]}>
            <Text style={styles.clearText}>{t('common.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Hint>{hint}</Hint> : null}
      <View style={styles.stepperRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('common.decrease')} ${label}`}
          onPress={() => set(value === null ? 0 : value - 1)}
          style={styles.stepBtn}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Slider
          style={{ flex: 1, height: 44 }}
          accessibilityLabel={label}
          minimumValue={0}
          maximumValue={10}
          step={1}
          value={value ?? 0}
          minimumTrackTintColor={value === null ? color.control : color.accent}
          maximumTrackTintColor={color.glassLineRaised}
          thumbTintColor={color.text}
          onValueChange={set}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('common.increase')} ${label}`}
          onPress={() => set(value === null ? 0 : value + 1)}
          style={styles.stepBtn}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** UX-10: a two-or-more way segmented control; exactly one segment is selected. */
export function Segmented({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: color.glassFill, borderWidth: 1, borderColor: color.glassLine }}>
      {items.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={i.label}
          accessibilityState={{ selected: i.id === value }}
          onPress={() => onChange(i.id)}
          style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: i.id === value ? color.accentSoft : 'transparent' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: i.id === value ? color.accent : color.soft }}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Tap-to-select chips. `selected` is the set of chosen ids; the caller decides single or multi select. */
export function Chips({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; label: string }[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: selected.has(item.id) }}
          onPress={() => onToggle(item.id)}
          hitSlop={3}
          style={[styles.chip, selected.has(item.id) && styles.chipOn]}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: selected.has(item.id) ? color.onAccent : color.soft }}>{selected.has(item.id) ? '✓ ' : ''}{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Editable timestamp so past entries can be added. Native iOS date-time picker, included in Expo Go. */
export function TimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <View style={styles.timeRow}>
      <Label>{t('common.time')}</Label>
      <DateTimePicker
        mode="datetime"
        value={value}
        onValueChange={(_e, d) => onChange(d)}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 16, gap: 14 },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6, color: color.text },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 1.2, color: color.muted, textTransform: 'uppercase' },
  hint: { fontSize: 13.5, color: color.muted },
  input: {
    borderWidth: 1,
    borderColor: color.glassLineRaised,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: color.text,
    backgroundColor: color.glassFillRaised,
  },
  button: { borderRadius: 999, minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: color.accent },
  secondary: { backgroundColor: color.glassFillRaised, borderWidth: 1, borderColor: color.glassLineRaised },
  outline: { borderWidth: 1.5, borderColor: color.accentLine },
  danger: { backgroundColor: color.alertSoft, borderWidth: 1, borderColor: color.alertLine },
  dangerSolid: { backgroundColor: color.alert },
  disabled: { backgroundColor: color.disabledFill },
  buttonText: { fontSize: 16, fontWeight: '700' },
  scoreBox: { gap: 2 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  clearText: { fontSize: 15, fontWeight: '600', color: color.accent },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperLabel: { flex: 1, fontSize: 16, color: color.text },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.glassFillRaised,
    borderWidth: 1,
    borderColor: color.glassLineRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 24, color: color.text },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 18, color: color.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    borderWidth: 1.5,
    borderColor: color.control,
    borderRadius: 999,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.glassLine },
  rowText: { fontSize: 16, fontWeight: '600', color: color.text },
});
