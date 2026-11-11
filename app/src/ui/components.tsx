import DateTimePicker from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';

export const Screen = ({ children }: { children: ReactNode }) => (
  <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
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
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], pressed && { opacity: 0.6 }]}>
      <Text style={[styles.buttonText, kind === 'secondary' && { color: '#208AEF' }]}>{title}</Text>
    </Pressable>
  );
}

/** 0-10 stepper: avoids a slider dependency and is quick to tap (NF-2). */
export function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('common.decrease')} ${label}`}
        onPress={() => onChange(Math.max(0, value - 1))}
        style={styles.stepBtn}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('common.increase')} ${label}`}
        onPress={() => onChange(Math.min(10, value + 1))}
        style={styles.stepBtn}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
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
  stepValue: { width: 28, textAlign: 'center', fontSize: 18, color: '#111' },
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
