import { SOURCE_KINDS, type IngredientSource } from '../model/source';
import { CANONICAL_UTC } from '../model/time';
import { bad, bool, isObj, nullableText, oneOf, str, type Obj } from './guards';

/** IN-16, EX-1: data.json form of an ingredient source, shared by meals, drinks and favorites. */
export const sourceToJson = (s: IngredientSource): Obj => ({
  kind: s.kind,
  edited: s.edited,
  llm: s.llm ? { model: s.llm.model, at: s.llm.at, prompt_version: s.llm.promptVersion } : null,
  ai_tags: s.aiTags,
});

/** Parses `o.source` (required) and checks that the LLM details exist exactly for the LLM sources. */
export function parseSource(o: Obj, where: string): IngredientSource {
  const s = o.source;
  if (!isObj(s)) return bad(`${where}.source`);
  const w = `${where}.source`;
  const kind = oneOf(s, 'kind', SOURCE_KINDS, w);
  const edited = bool(s, 'edited', w);
  const isLlm = kind === 'label_scan' || kind === 'photo_estimate';
  let llm: IngredientSource['llm'] = null;
  if (isLlm) {
    if (!isObj(s.llm)) return bad(`${w}.llm`);
    const at = str(s.llm, 'at', `${w}.llm`);
    if (!CANONICAL_UTC.test(at)) return bad(`${w}.llm.at`);
    llm = { model: str(s.llm, 'model', `${w}.llm`), at, promptVersion: str(s.llm, 'prompt_version', `${w}.llm`) };
  } else if (s.llm !== null && s.llm !== undefined) return bad(`${w}.llm`);
  if (kind === 'typed' && edited) return bad(`${w}.edited`);
  const aiTags = s.ai_tags === undefined ? false : bool(s, 'ai_tags', w);
  return { kind, edited, llm, aiTags };
}

/** The barcode of an entry: digits only, or null. */
export function parseBarcode(o: Obj, where: string): string | null {
  const v = nullableText(o, 'barcode', where);
  return v === null || /^\d{8,14}$/.test(v) ? v : bad(`${where}.barcode`);
}
