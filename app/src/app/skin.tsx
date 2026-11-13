import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SCORE_KEYS, type SkinArea, type SkinEntry, type SkinScores } from '@/core/model/types';
import { lastSkinScores, listActiveAreas, logSkinEntry, repeatSkinEntry } from '@/core/usecases/skin';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Heading, Hint, Label, Screen, ScoreStepper, TimeField, styles } from '@/ui/components';

const ZERO: SkinScores = { severity: 0, itch: 0, pain: 0, dryness: 0, scaling: 0 };

/** SK-1 to SK-3: per-area entry with five separate 0-10 scores. */
export default function SkinScreen() {
  const { deps } = useServices();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [recent, setRecent] = useState<SkinEntry[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [scores, setScores] = useState<SkinScores>(ZERO);
  const [note, setNote] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const [hasLast, setHasLast] = useState(false);

  const reload = useCallback(() => {
    listActiveAreas(deps, 'skin').then((a) => {
      setAreas(a);
      setAreaId((cur) => (cur && a.some((x) => x.id === cur) ? cur : (a[0]?.id ?? null)));
    });
    deps.repo.listSkinEntries().then((e) => setRecent(e.slice(0, 5)));
  }, [deps]);
  useFocusEffect(reload);

  /** SK-3: start from the area's last scores so a small change is a tap or two. */
  const prefill = useCallback(
    (id: string) =>
      lastSkinScores(deps, id).then((last) => {
        setHasLast(!!last);
        setScores(last ?? ZERO);
      }),
    [deps],
  );
  useEffect(() => {
    if (areaId) prefill(areaId);
  }, [areaId, prefill]);

  async function save() {
    try {
      if (!areaId) return;
      await logSkinEntry(deps, { areaId, scores, note, at: at ?? undefined });
      setNote('');
      setAt(null);
      reload();
      prefill(areaId);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  async function noChange() {
    try {
      if (!areaId) return;
      await repeatSkinEntry(deps, areaId, at ?? undefined);
      setAt(null);
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  }

  const labelFor = (id: string) => {
    const a = areas.find((x) => x.id === id);
    return a ? areaLabel(a) : id;
  };

  return (
    <Screen>
      <Heading>{t('skin.title')}</Heading>
      <Label>{t('skin.area')}</Label>
      <View style={styles.chips}>
        {areas.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            onPress={() => setAreaId(a.id)}
            style={[styles.chip, a.id === areaId && styles.chipOn]}>
            <Text style={{ color: a.id === areaId ? '#fff' : '#111' }}>{areaLabel(a)}</Text>
          </Pressable>
        ))}
      </View>

      {hasLast && (
        <>
          <Button kind="secondary" title={t('skin.noChange')} onPress={noChange} />
          <Hint>{t('skin.noChangeHint')}</Hint>
          <Hint>{t('skin.prefilled')}</Hint>
        </>
      )}
      <Hint>{t('skin.scale')}</Hint>
      {SCORE_KEYS.map((k) => (
        <ScoreStepper
          key={k}
          label={t(`skin.scores.${k}`)}
          value={scores[k]}
          onChange={(v) => setScores((s) => ({ ...s, [k]: v }))}
        />
      ))}

      <TimeField value={at ?? new Date()} onChange={setAt} />
      <Label>{t('common.note')}</Label>
      <TextInput style={styles.input} value={note} onChangeText={setNote} />
      <Button title={t('common.save')} onPress={save} />

      <Label>{t('common.recent')}</Label>
      {recent.length === 0 && <Hint>{t('common.nothingYet')}</Hint>}
      {recent.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.rowText}>
            {new Date(e.at.utc).toLocaleString()} · {labelFor(e.areaId)}
          </Text>
          <Hint>{SCORE_KEYS.map((k) => `${t(`skin.scores.${k}`)} ${e.scores[k]}`).join(' · ')}</Hint>
        </View>
      ))}
    </Screen>
  );
}
