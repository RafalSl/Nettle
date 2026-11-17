import { Switch, Text, View } from 'react-native';
import { t } from '@/i18n';
import { Hint, styles } from '@/ui/components';

/** IN-20: the "Fill later with AI" switch of a meal or drink. It only marks the entry for the next AI pack (LL-15). */
export function FillLaterSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <>
      <View style={styles.timeRow}>
        <Text style={styles.rowText}>{t('fillLater.title')}</Text>
        <Switch value={value} onValueChange={onChange} accessibilityLabel={t('fillLater.title')} />
      </View>
      {value && <Hint>{t('fillLater.hint')}</Hint>}
    </>
  );
}
