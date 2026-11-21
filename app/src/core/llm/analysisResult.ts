import { HYPOTHESIS_STRENGTHS, type AnalysisResult, type Hypothesis } from '../model/types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strList = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isStr) ? (v as string[]) : null);

/**
 * The JSON shape both the model answers with and `data.json` stores (snake_case). Returns null when the value
 * does not have exactly the expected shape, so callers choose their own error.
 */
export function analysisResultFromJson(raw: unknown): AnalysisResult | null {
  if (!isObj(raw)) return null;
  const { summary, hypotheses, order_and_lag: orderAndLag } = raw;
  const dataLimits = strList(raw.data_limits);
  const doctorQuestions = strList(raw.questions_for_doctor);
  if (!isStr(summary) || !isStr(orderAndLag) || !dataLimits || !doctorQuestions || !Array.isArray(hypotheses)) return null;
  const parsed: Hypothesis[] = [];
  for (const h of hypotheses) {
    if (!isObj(h)) return null;
    const evidence = strList(h.evidence);
    const counter = strList(h.counter_evidence);
    const lag = h.lag_hours;
    if (
      !isStr(h.title) ||
      !isStr(h.explanation) ||
      !isStr(h.uncertainty) ||
      !evidence ||
      !counter ||
      !(lag === null || (typeof lag === 'number' && Number.isFinite(lag) && lag >= 0 && lag <= 24 * 30)) ||
      !HYPOTHESIS_STRENGTHS.includes(h.strength as never)
    ) {
      return null;
    }
    parsed.push({
      title: h.title,
      explanation: h.explanation,
      evidence,
      counterEvidence: counter,
      uncertainty: h.uncertainty,
      lagHours: lag,
      strength: h.strength as Hypothesis['strength'],
    });
  }
  return { summary, hypotheses: parsed, orderAndLag, dataLimits, doctorQuestions };
}

export function analysisResultToJson(r: AnalysisResult): Obj {
  return {
    summary: r.summary,
    hypotheses: r.hypotheses.map((h) => ({
      title: h.title,
      explanation: h.explanation,
      evidence: h.evidence,
      counter_evidence: h.counterEvidence,
      uncertainty: h.uncertainty,
      lag_hours: h.lagHours,
      strength: h.strength,
    })),
    order_and_lag: r.orderAndLag,
    data_limits: r.dataLimits,
    questions_for_doctor: r.doctorQuestions,
  };
}
