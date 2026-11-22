import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DEFAULT_FLARE_THRESHOLD } from '@/core/model/flares';
import type { FlareScope } from '@/core/model/preferences';
import type { SkinArea } from '@/core/model/types';
import { getPreferences, setAreaFlareThreshold, setFlareScope, setFlareThreshold } from '@/core/usecases/preferences';
import { areaLabel, t } from '@/i18n';
import { useServices } from '@/services';
import { Chips, Heading, Hint, Label, Segmented } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';
import { showError } from '@/ui/showError';

/**
 * SK-6, SK-8, UX-6: the severity at or above which skin entries count as a flare. "Same for all" is one value for
 * every area; "Per area" gives each skin area its own value and the others follow the common one. Saved at once;
 * flares are recomputed from the entries.
 */
export function FlareThresholdSection() {
  const { deps } = useServices();
  const [threshold, setThreshold] = useState(DEFAULT_FLARE_THRESHOLD);
  const [scope, setScope] = useState<FlareScope>('all');
  const [byArea, setByArea] = useState<Record<string, number>>({});
  const [areas, setAreas] = useState<SkinArea[]>([]);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = await getPreferences(deps);
        setThreshold(p.flareThreshold);
        setScope(p.flareScope);
        setByArea(p.flareThresholdByArea);
        setAreas((await deps.repo.listAreas()).filter((a) => a.kind === 'skin' && !a.archived));
      })().catch((e) => showError(e));
    }, [deps]),
  );
  const fail = (e: unknown) => showError(e);
  const step = (a: SkinArea, delta: number) => {
    const next = Math.min(10, Math.max(1, (byArea[a.id] ?? threshold) + delta));
    setAreaFlareThreshold(deps, a.id, next).then(setByArea, fail);
  };
  return (
    <>
      <Heading>{t('settings.flareThresholdTitle')}</Heading>
      <Segmented
        items={[
          { id: 'all', label: t('settings.flareScopeAll') },
          { id: 'perArea', label: t('settings.flareScopeArea') },
        ]}
        value={scope}
        onChange={(id) => void setFlareScope(deps, id as FlareScope).then(setScope, fail)}
      />
      <Label>{t('settings.flareThresholdLabel')}</Label>
      <Chips
        items={Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))}
        selected={new Set([String(threshold)])}
        onToggle={(id) => {
          setFlareThreshold(deps, Number(id)).then(setThreshold, fail);
        }}
      />
      {scope === 'perArea' && (
        <View style={{ gap: 8 }}>
          <Hint>{t('settings.flareScopeAreaHint')}</Hint>
          {areas.map((a) => (
            <GlassSurface
              key={a.id}
              style={{
                borderRadius: 999,
                paddingVertical: 6,
                paddingLeft: 18,
                paddingRight: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '600' }}>{areaLabel(a)}</Text>
                <Text style={{ fontSize: 12.5, color: color.muted }}>
                  {byArea[a.id] === undefined ? t('settings.flareSameAsCommon') : ' '}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('common.decrease')} ${areaLabel(a)}`}
                onPress={() => step(a, -1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: color.glassFillRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="minus" size={18} wash={false} stroke={2.2} />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '800', minWidth: 26, textAlign: 'center' }}>{byArea[a.id] ?? threshold}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('common.increase')} ${areaLabel(a)}`}
                onPress={() => step(a, 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: color.glassFillRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="plus" size={18} wash={false} stroke={2.2} />
              </Pressable>
              {byArea[a.id] !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('settings.flareUseCommon')} ${areaLabel(a)}`}
                  onPress={() => void setAreaFlareThreshold(deps, a.id, null).then(setByArea, fail)}
                  hitSlop={6}
                  style={{ paddingHorizontal: 8 }}
                >
                  <Icon name="x" size={16} wash={false} stroke={2} tint={color.muted} />
                </Pressable>
              ) : null}
            </GlassSurface>
          ))}
        </View>
      )}
      <Hint>{t('settings.flareThresholdHint')}</Hint>
    </>
  );
}
