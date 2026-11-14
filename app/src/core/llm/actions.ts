/**
 * LL-9: every LLM action has its own model setting. A later action is added here and gets the default model
 * until the user picks another one in Settings, AI analysis.
 */
export const LLM_ACTIONS = ['label_scan', 'meal_photo', 'analysis', 'report_summary'] as const;
export type LlmAction = (typeof LLM_ACTIONS)[number];
