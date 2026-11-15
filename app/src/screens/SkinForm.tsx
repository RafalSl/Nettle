import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { SCORE_KEYS, type SkinArea, type SkinScores } from '@/core/model/types';
import { attachPhotos } from '@/core/usecases/photos';
import { lastSkinScores, listActiveAreas, logSkinEntry, repeatAllAreas, repeatSkinEntry } from '@/core/usecases/skin';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { FormModal, useField, useForm } from '@/ui/FormModal';
import { PendingPhotos } from '@/ui/PendingPhotos';
import { useFormTime } from '@/ui/useFormTime';
import { Button, Chips, Hint, Label, ScoreInput, TimeField, styles } from '@/ui/components';

const ZERO: SkinScores = { severity: 0, itch: 0, pain: 0, dryness: 0, scaling: 0 };

/**
 * SK-1 to SK-3, SK-6: a per-area entry with five separate 0-10 scores, prefilled from the area's last values.
 * "No change" saves it in one tap, and "No change for all areas" saves every area that has an earlier entry.
 * Flares are derived from severity (SK-6). Photos picked here are saved with the entry (SK-4); "No change" with a
 * photo is a photo-only update.
 */
export default function SkinForm() {
  const { deps } = useServices();
  const router = useRouter();
  const f = useForm();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [areaId, setAreaId] = useField<string | null>(null, f.touch);
  const [scores, setScores] = useState<SkinScores>(ZERO);
  const [note, setNote] = useField('', f.touch);
  const [hasLast, setHasLast] = useState(false);
  const [photos, setPhotos] = useField<string[]>([], f.touch);
  const time = useFormTime(f.touch);

  const reload = useCallback(() => {
    listActiveAreas(deps, 'skin').then(setAreas);
  }, [deps]);
  useFocusEffect(reload);
  const selected = areaId && areas.some((a) => a.id === areaId) ? areaId : (areas[0]?.id ?? null);

  /** SK-3: start from the area's last scores so a small change is a tap or two. */
  useEffect(() => {
    if (!selected) return;
    lastSkinScores(deps, selected).then((last) => {
      setHasLast(!!last);
      setScores(last ?? ZERO);
    });
  }, [deps, selected]);

  const act = async (fn: () => Promise<unknown>, close: boolean) => {
    try {
      await fn();
      if (close) router.back();
      else reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  /** SK-4: the photos picked in this form go to the entry that was just saved; a failure never undoes the entry. */
  async function attach(entryId: string, atUtc: string) {
    const { failed } = await attachPhotos(deps, 'skinEntry', entryId, photos, new Date(atUtc));
    if (failed > 0) Alert.alert(t('photos.someFailed', { n: failed }));
  }

  async function noChangeAll() {
    try {
      const result = await repeatAllAreas(deps, time.atForSave);
      if (result.needFirstEntry.length > 0) {
        Alert.alert(t('skin.noChangeAllDone', { n: result.saved.length }), t('skin.noChangeAllNeed', { list: result.needFirstEntry.map(areaLabel).join(', ') }));
      }
      router.back();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  return (
    <FormModal
      dirty={f.dirty}
      missing={selected ? null : t('edit.area')}
      onSave={async () => {
        const entry = await logSkinEntry(deps, { areaId: selected!, scores, note, at: time.atForSave });
        await attach(entry.id, entry.at.utc);
      }}>
      <Label>{t('skin.area')}</Label>
      <Chips items={areas.map((a) => ({ id: a.id, label: areaLabel(a) }))} selected={new Set(selected ? [selected] : [])} onToggle={setAreaId} />
      {hasLast && (
        <>
          <Button kind="secondary" title={t('skin.noChange')} onPress={() =>
              void act(async () => {
                const entry = await repeatSkinEntry(deps, selected!, time.atForSave); // SK-4: "No change" plus a photo is a photo-only update
                await attach(entry.id, entry.at.utc);
              }, true)
            }
          />
          <Hint>{t('skin.noChangeHint')}</Hint>
        </>
      )}
      <Button kind="secondary" title={t('skin.noChangeAll')} onPress={() => void noChangeAll()} />
      <Hint>{t('skin.scale')}</Hint>
      {hasLast && <Hint>{t('skin.prefilled')}</Hint>}
      {SCORE_KEYS.map((k) => (
        <ScoreInput key={k} label={t(`skin.scores.${k}`)} value={scores[k]} onChange={(v) => (f.touch(), setScores((s) => ({ ...s, [k]: v })))} />
      ))}
      <PendingPhotos uris={photos} onChange={setPhotos} />
      <TimeField value={time.value} onChange={time.set} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} accessibilityLabel={t('common.note')} value={note} onChangeText={setNote} />
    </FormModal>
  );
}
