import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';

export const Screen = ({ children }: { children: ReactNode }) => (
  <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);

export const Heading = ({ children }: { children: ReactNode }) => (
  <Text style={styles.heading}>{children}</Text>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Hint = ({ children }: { children: ReactNode }) => (
  <Text style={styles.hint}>{children}</Text>
);

export function Button({
  title,
  onPress,
  kind = 'primary',
  accessibilityLabel,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.button, styles[kind], (pressed || disabled) && { opacity: disabled ? 0.4 : 0.6 }]}>
      <Text style={[styles.buttonText, kind === 'secondary' && { color: '#208AEF' }]}>{title}</Text>
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
          minimumTrackTintColor={value === null ? '#c7c7cc' : '#208AEF'}
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
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#208AEF', borderRadius: 8, overflow: 'hidden' }}>
      {items.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={i.label}
          accessibilityState={{ selected: i.id === value }}
          onPress={() => onChange(i.id)}
          style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: i.id === value ? '#208AEF' : 'transparent' }}>
          <Text style={{ fontSize: 16, color: i.id === value ? '#fff' : '#208AEF' }}>{i.label}</Text>
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
          style={[styles.chip, selected.has(item.id) && styles.chipOn]}>
          <Text style={{ color: selected.has(item.id) ? '#fff' : '#111' }}>{item.label}</Text>
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
  screen: { padding: 16, paddingTop: 24, gap: 12 },
  heading: { fontSize: 22, fontWeight: '600', color: '#111' },
  label: { fontSize: 15, fontWeight: '500', color: '#222' },
  hint: { fontSize: 13, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primary: { backgroundColor: '#208AEF' },
  secondary: { backgroundColor: '#e8f2fe' },
  danger: { backgroundColor: '#c0392b' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scoreBox: { gap: 2 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  clearText: { fontSize: 16, color: '#208AEF' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperLabel: { flex: 1, fontSize: 16, color: '#111' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 24, color: '#208AEF' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 18, color: '#111' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  rowText: { color: '#111' },
});
