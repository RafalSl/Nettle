import type { Language } from '../ports/llm';

/** LL-7: bump when a prompt changes, so a stored analysis says which prompt produced it. */
export const INGREDIENTS_PROMPT_VERSION = 'ingredients-1';

const LANGUAGE_NAME: Record<Language, string> = { en: 'English', pl: 'Polish' };

/** LL-11: the answer language follows the app language. */
export const languageName = (language: Language) => LANGUAGE_NAME[language];

/** LL-1, IN-3: provider-agnostic prompt for estimating ingredients from a meal photo. */
export function ingredientsPrompt(language: Language) {
  return {
    system: [
      'You help someone keep a food diary to look for possible triggers of skin problems.',
      'You look at a photo of a meal and list the ingredients you can see or reasonably expect in it.',
      'Your answer is a suggestion that the user will review and correct. Do not give medical advice or diagnoses.',
      `Write ingredient names in ${languageName(language)}, as short generic food names (for example "tomato", "wheat bread"), one per item, no quantities.`,
      'Include likely hidden ingredients (oil, sauce, spices) only when they are very likely, and say in "uncertainty" what you are unsure about.',
      'If the image is not a meal, return an empty list and explain in "uncertainty".',
    ].join(' '),
    user: 'List the ingredients of this meal.',
    schema: {
      type: 'object',
      properties: {
        ingredients: { type: 'array', items: { type: 'string' } },
        uncertainty: { type: ['string', 'null'] },
      },
      required: ['ingredients', 'uncertainty'],
      additionalProperties: false,
    },
    maxTokens: 2000,
  };
}
