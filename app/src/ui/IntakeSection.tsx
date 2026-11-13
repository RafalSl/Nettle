import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import type { MedicationCategory } from '@/core/model/types';
import { logAlcohol, logMedication } from '@/core/usecases/intake';
import { errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, TimeField, styles } from '@/ui/components';

/** IN-4 alcohol and IN-5 medications and supplements: short forms, time editable. */
export function IntakeSection() {
  const { deps } = useServices();
  const [drink, setDrink] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [category, setCategory] = useState<MedicationCategory>('medication');
  const [at, setAt] = useState<Date | null>(null);

  async function saveAlcohol() {
    try {
      await logAlcohol(deps, { drink, amountMl: Number(amount), at: at ?? undefined });
      setDrink('');
      setAmount('');
      setAt(null);
      Alert.alert(t('more.logged'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function saveMedication() {
    try {
      await logMedication(deps, { category, name, dose, at: at ?? undefined });
      setName('');
      setDose('');
      setAt(null);
      Alert.alert(t('more.logged'));
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <>
      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Heading>{t('more.alcoholTitle')}</Heading>
      <TextInput style={styles.input} placeholder={t('more.alcoholDrink')} value={drink} onChangeText={setDrink} />
      <TextInput style={styles.input} placeholder={t('more.alcoholAmount')} keyboardType="number-pad" value={amount} onChangeText={setAmount} />
      <Button title={t('more.alcoholSave')} onPress={saveAlcohol} />

      <Heading>{t('more.medTitle')}</Heading>
      <Chips
        items={[
          { id: 'medication', label: t('more.medKindMedication') },
          { id: 'supplement', label: t('more.medKindSupplement') },
        ]}
        selected={new Set([category])}
        onToggle={(id) => setCategory(id as MedicationCategory)}
      />
      <View style={{ gap: 8 }}>
        <TextInput style={styles.input} placeholder={t('more.medName')} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder={t('more.medDose')} value={dose} onChangeText={setDose} />
      </View>
      <Button title={t('more.medSave')} onPress={saveMedication} />
    </>
  );
}
