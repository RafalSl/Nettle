/** A parsed JSON object (not an array, not null). */
export type Obj = Record<string, unknown>;

/** Narrows untrusted parsed JSON (an import, a model's answer) to a plain object. */
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
