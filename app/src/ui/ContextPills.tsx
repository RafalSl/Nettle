import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { localDay } from '@/core/model/time';
import type { ContextPill } from '@/core/usecases/today';
import { t } from '@/i18n';
import { GlassSurface } from '@/ui/GlassSurface';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/themed';
import { color } from '@/ui/theme';

function Pill({ icon, text, alert = false, badge, onPress }: { icon: IconName; text: string; alert?: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress}>
      <GlassSurface style={{ borderRadius: 999, paddingVertical: 8, paddingLeft: 8, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, ...(alert ? { backgroundColor: color.alertSoft, borderColor: color.alertLine } : {}) }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alert ? color.alert : color.glassFillRaised }}>
          {badge !== undefined ? <Text style={{ fontSize: 14, fontWeight: '800', color: color.onAlert }}>{badge}</Text> : <Icon name={icon} size={16} wash={false} />}
        </View>
        <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: alert ? color.alert : color.text }} numberOfLines={2}>
          {text}
        </Text>
        <Icon name="chev" size={14} tint={color.muted} wash={false} stroke={2} />
      </GlassSurface>
    </Pressable>
  );
}

/**
 * UX-2: the context pills, at most two (the core decides which). A pill says what is going on and opens the screen
 * that deals with it.
 */
export function ContextPills({ pills, areaName, startHour }: { pills: ContextPill[]; areaName: (id: string) => string; startHour: number }) {
  const router = useRouter();
  return (
    <View style={{ gap: 8 }}>
      {pills.map((p) => {
        switch (p.kind) {
          case 'flare': {
            const f = p.flare;
            const text =
              f.areas.length === 1
                ? t('cards.openFlareOne', { area: areaName(f.areas[0]!.areaId), severity: f.areas[0]!.severity, since: localDay(f.period.start.utc, f.period.start.tz, startHour) })
                : t('cards.openFlareMany', { n: f.period.areaIds.length, area: areaName(f.areas[0]!.areaId) });
            return <Pill key="flare" icon="flame" alert badge={f.areas[0]?.severity} text={text} onPress={() => router.navigate({ pathname: '/review', params: { view: 'areas' } })} />;
          }
          case 'checkin':
            return <Pill key="checkin" icon="health" text={t('cards.notLogged')} onPress={() => router.push('/form/checkin')} />;
          case 'backup':
            return <Pill key="backup" icon="box" text={p.days === null ? t('cards.noExport') : t('cards.lastExport', { days: p.days })} onPress={() => router.push('/settings/data')} />;
          case 'suggestions':
            return <Pill key="suggestions" icon="sparkle" text={t('cards.suggestions', { n: p.count })} onPress={() => router.push('/today/suggestions')} />;
        }
      })}
    </View>
  );
}
