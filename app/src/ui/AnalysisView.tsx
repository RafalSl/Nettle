import { View } from 'react-native';
import { Text } from '@/ui/themed';
import { localDateTime } from '@/core/model/time';
import type { Analysis } from '@/core/model/types';
import { t } from '@/i18n';
import { Heading, Hint, Label, styles } from '@/ui/components';
import { color } from '@/ui/theme';

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <View style={{ gap: 2 }}>
      <Label>{title}</Label>
      {items.map((x, i) => (
        <Text key={i} style={styles.rowText}>
          • {x}
        </Text>
      ))}
    </View>
  );

/** EX-4, LL-4: a stored analysis, always labelled as AI-generated and tentative. */
export function AnalysisView({ analysis }: { analysis: Analysis }) {
  const r = analysis.result;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: color.alert, fontWeight: '600' }}>{t('analysis.disclaimer')}</Text>
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
      <Text style={styles.rowText}>{r.summary}</Text>
      <Heading>{t('analysis.hypotheses')}</Heading>
      {r.hypotheses.length === 0 && <Hint>{t('analysis.noHypotheses')}</Hint>}
      {r.hypotheses.map((h, i) => (
        <View key={i} style={[styles.row, { gap: 4 }]}>
          <Text style={[styles.rowText, { fontWeight: '600' }]}>
            {h.title} ({t(`analysis.strength.${h.strength}`)})
          </Text>
          <Text style={styles.rowText}>{h.explanation}</Text>
          <List title={t('analysis.evidence')} items={h.evidence} />
          <List title={t('analysis.counter')} items={h.counterEvidence} />
          <Hint>
            {t('analysis.uncertainty')}: {h.uncertainty}
          </Hint>
          {h.lagHours !== null && <Hint>{t('analysis.lag', { h: h.lagHours })}</Hint>}
        </View>
      ))}
      <Label>{t('analysis.order')}</Label>
      <Text style={styles.rowText}>{r.orderAndLag}</Text>
      <List title={t('analysis.limits')} items={r.dataLimits} />
      <List title={t('analysis.questions')} items={r.doctorQuestions} />
    </View>
  );
}
