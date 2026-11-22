import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { TextInput } from '@/ui/themed';
import type { AreaKind, SkinArea } from '@/core/model/types';
import { addArea, archiveSkinArea, renameSkinArea, resetSkinAreaName, setAreaSensitiveDefault } from '@/core/usecases/skin';
import { areaLabel, errorMessage, t } from '@/i18n';
import { useServices } from '@/services';
import { Button, Chips, Heading, Hint, Label, styles } from '@/ui/components';
import { SwitchRow } from '@/ui/SwitchRow';

/**
 * SK-2, SK-10, UX-6: add, rename and archive the skin or nail areas. Active names are unique. A predefined area
 * keeps its id and gets a name override that "Default name" clears; an archived area keeps its history and can be restored.
 */
export function AreasSection({ kind }: { kind: AreaKind }) {
  const { deps } = useServices();
  const [areas, setAreas] = useState<SkinArea[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const reload = useCallback(() => {
    deps.repo.listAreas().then((all) => setAreas(all.filter((a) => a.kind === kind)));
  }, [deps, kind]);
  useFocusEffect(reload);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setName('');
      reload();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  const active = areas.filter((a) => !a.archived);
  const archived = areas.filter((a) => a.archived);
  const current = areas.find((a) => a.id === selected && !a.archived);

  return (
    <>
      <Heading>{t(kind === 'skin' ? 'settings.skinAreas' : 'settings.nailAreas')}</Heading>
      <Chips
        items={active.map((a) => ({ id: a.id, label: areaLabel(a) }))}
        selected={new Set(selected ? [selected] : [])}
        onToggle={setSelected}
      />
      <TextInput
        style={styles.input}
        accessibilityLabel={t(`settings.${kind}AreaName`)}
        placeholder={t(`settings.${kind}AreaName`)}
        value={name}
        onChangeText={setName}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" title={t('common.add')} onPress={() => run(() => addArea(deps, name, kind))} />
        {current && (
          <>
            <Button kind="secondary" title={t('more.rename')} onPress={() => run(() => renameSkinArea(deps, current.id, name))} />
            {current.predefined && current.nameOverride !== null && (
              <Button kind="secondary" title={t('settings.defaultName')} onPress={() => run(() => resetSkinAreaName(deps, current.id))} />
            )}
            <Button
              kind="secondary"
              title={t('more.archive')}
              onPress={() =>
                run(async () => {
                  await archiveSkinArea(deps, current.id);
                  setSelected(null);
                })
              }
            />
          </>
        )}
      </View>
      {current && (
        // SK-5: new photos of this area start as sensitive; a photo can still be changed one by one.
        <SwitchRow
          title={t('settings.sensitiveDefault')}
          value={current.sensitiveDefault}
          onChange={(v) => run(() => setAreaSensitiveDefault(deps, current.id, v))}
        />
      )}
      {archived.length > 0 && (
        <>
          <Label>{t('more.archivedList')}</Label>
          <Hint>{t('more.restore')}</Hint>
          <Chips
            items={archived.map((a) => ({ id: a.id, label: areaLabel(a) }))}
            selected={new Set()}
            onToggle={(id) => run(() => archiveSkinArea(deps, id, false))}
          />
        </>
      )}
    </>
  );
}
