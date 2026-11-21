import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '@/ui/themed';
import { localDay } from '@/core/model/time';
import { MAX_MEDICAL_TITLE, MEDICAL_KINDS, type LocalDay, type MedicalKind } from '@/core/model/types';
import { logMedicalEvent } from '@/core/usecases/events';
import { t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { useFormTime } from '@/ui/useFormTime';
import { Button, Chips, Hint, Label, TimeField, styles } from '@/ui/components';

/** IN-18: the end date of an illness, optional. A tap opens a date picker; Clear removes it. */
function EndDayField({ value, onChange }: { value: LocalDay | null; onChange: (d: LocalDay | null) => void }) {
  const { deps } = useServices();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.timeRow}>
        <Label>{t('medical.endDay')}</Label>
        <Text style={styles.rowText}>{value ?? t('medical.endNone')}</Text>
      </View>
      <Button kind="secondary" title={value ? t('medical.endChange') : t('medical.endSet')} onPress={() => setOpen((o) => !o)} />
      {open && (
        <DateTimePicker
          mode="date"
          display="inline"
          value={new Date(`${value ?? localDay(deps.clock.now().toISOString(), deps.clock.timeZone())}T12:00:00`)}
          onValueChange={(_e, d) => {
            onChange(localDay(d.toISOString(), deps.clock.timeZone()));
            setOpen(false);
          }}
        />
      )}
      {value && <Button kind="secondary" title={t('common.clear')} accessibilityLabel={t('medical.endClear')} onPress={() => onChange(null)} />}
      <Hint>{t('medical.endHint')}</Hint>
    </>
  );
}

/** IN-18: kind, title and, for an illness, an optional end date; shared by the new-entry form and the edit form. */
export function MedicalFields({
  kind,
  onKind,
  title,
  onTitle,
  endDay,
  onEndDay,
}: {
  kind: MedicalKind;
  onKind: (k: MedicalKind) => void;
  title: string;
  onTitle: (v: string) => void;
  endDay: LocalDay | null;
  onEndDay: (d: LocalDay | null) => void;
}) {
  return (
    <>
      <Chips items={MEDICAL_KINDS.map((k) => ({ id: k, label: t(`medical.kinds.${k}`) }))} selected={new Set([kind])} onToggle={(id) => onKind(id as MedicalKind)} />
      <TextInput style={styles.input} accessibilityLabel={t('medical.title')} placeholder={t('medical.title')} maxLength={MAX_MEDICAL_TITLE} value={title} onChangeText={onTitle} />
      {kind === 'illness' && <EndDayField value={endDay} onChange={onEndDay} />}
    </>
  );
}

/** IN-18: log a visit, test result, diagnosis, illness or other medical event. Nothing leaves the phone. */
export function MedicalEventSection() {
  const { deps } = useServices();
  const f = useForm();
  const [kind, setKind] = useField<MedicalKind>('visit', f.touch);
  const [title, setTitle] = useField('', f.touch);
  const [endDay, setEndDay] = useField<LocalDay | null>(null, f.touch);
  const [note, setNote] = useField('', f.touch);
  const time = useFormTime(f.touch);
  return (
    <FormModal
      dirty={f.dirty}
      missing={title.trim() ? null : t('edit.titleMissing')}
      onSave={async () => void (await logMedicalEvent(deps, { kind, title, ...(kind === 'illness' ? { endDay } : {}), note, at: time.atForSave }))}>
      <MedicalFields kind={kind} onKind={setKind} title={title} onTitle={setTitle} endDay={endDay} onEndDay={setEndDay} />
      <TimeField value={time.value} onChange={time.set} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={setNote} />
    </FormModal>
  );
}
