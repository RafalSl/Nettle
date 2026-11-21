import { View } from 'react-native';
import { Text } from '@/ui/themed';
import { localDateTime } from '@/core/model/time';
import type { Analysis } from '@/core/model/types';
import { t } from '@/i18n';
import { Heading, Hint, Label, styles } from '@/ui/components';
import { GlassSurface } from '@/ui/GlassSurface';
import { color } from '@/ui/theme';

const List = ({ title, items, tone }: { title: string; items: string[]; tone?: 'against' }) =>
  items.length === 0 ? null : (
    <View style={{ gap: 2 }}>
      <Label>{title}</Label>
      {items.map((x, i) => (
        <Text key={i} style={[styles.rowText, { fontWeight: '400', fontSize: 15, color: tone === 'against' ? color.soft : color.text }]}>
          • {x}
        </Text>
      ))}
    </View>
  );

/**
 * EX-4, LL-4: a stored analysis, always labelled as AI-generated and tentative. Each possible pattern is a glass card with
 * its evidence, what speaks against it and the uncertainty; then the order and lag, what the data cannot show and
 * questions for the doctor (never advice).
 */
export function AnalysisView({ analysis }: { analysis: Analysis }) {
  const r = analysis.result;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ padding: 14, borderRadius: 22, backgroundColor: color.alertSoft, borderWidth: 1, borderColor: color.alertLine }}>
        <Text style={{ color: color.alert, fontWeight: '600', fontSize: 14.5 }}>{t('analysis.disclaimer')}</Text>
      </View>
      <Hint>
        {t('analysis.meta', {
          date: localDateTime(analysis.at.utc, analysis.at.tz),
          from: analysis.dayFrom,
          to: analysis.dayTo,
          model: analysis.model,
          prompt: analysis.promptVersion,
        })}
      </Hint>
      {analysis.manual && <Hint>{t('plan.manualLabel', { model: analysis.model })}</Hint>}
      <Heading>{t('analysis.summary')}</Heading>
      <Text style={[styles.rowText, { fontWeight: '400', fontSize: 15.5 }]}>{r.summary}</Text>
      <Heading>{t('analysis.hypotheses')}</Heading>
      {r.hypotheses.length === 0 && <Hint>{t('analysis.noHypotheses')}</Hint>}
      {r.hypotheses.map((h, i) => (
        <GlassSurface key={i} style={{ borderRadius: 26, padding: 16, gap: 8 }}>
          <Text style={[styles.rowText, { fontWeight: '700', fontSize: 16.5 }]}>
            {h.title} ({t(`analysis.strength.${h.strength}`)})
          </Text>
          <Text style={[styles.rowText, { fontWeight: '400', fontSize: 15 }]}>{h.explanation}</Text>
          <List title={t('analysis.evidence')} items={h.evidence} />
          <List title={t('analysis.counter')} items={h.counterEvidence} tone="against" />
          <Hint>
            {t('analysis.uncertainty')}: {h.uncertainty}
          </Hint>
          {h.lagHours !== null && <Hint>{t('analysis.lag', { h: h.lagHours })}</Hint>}
        </GlassSurface>
      ))}
      <Label>{t('analysis.order')}</Label>
      <Text style={[styles.rowText, { fontWeight: '400', fontSize: 15 }]}>{r.orderAndLag}</Text>
      <List title={t('analysis.limits')} items={r.dataLimits} />
      <List title={t('analysis.questions')} items={r.doctorQuestions} />
    </View>
  );
}
