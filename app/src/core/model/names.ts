/** SK-2, IN-5: the name an area or list item goes by: the user's own name for it, else the stored one (untranslated). */
export const shownName = (x: { name: string; nameOverride: string | null }): string => x.nameOverride ?? x.name;
