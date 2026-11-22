import { SCORE_KEYS, type SkinScores } from '@/core/model/types';
import { t } from '@/i18n';
import { ScoreInput } from '@/ui/components';
import { SkinExtraFields } from '@/forms/skin/SkinExtraFields';

/** SK-3: the five 0-10 scores, cracks and the optional size; shared by the new-entry form and the edit form. */
export function SkinScoreFields(p: {
  scores: SkinScores;
  onScores: (next: SkinScores) => void;
  cracks: boolean;
  onCracks: (v: boolean) => void;
  sizeText: string;
  onSizeText: (v: string) => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  return (
    <>
      {SCORE_KEYS.map((k) => (
        <ScoreInput key={k} label={t(`skin.scores.${k}`)} value={p.scores[k]} onChange={(v) => p.onScores({ ...p.scores, [k]: v })} />
      ))}
      <SkinExtraFields
        cracks={p.cracks}
        onCracks={p.onCracks}
        sizeText={p.sizeText}
        onSizeText={p.onSizeText}
        open={p.detailsOpen}
        onToggleOpen={p.onToggleDetails}
      />
    </>
  );
}
