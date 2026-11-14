/**
 * SK-9: whether a form with unsaved changes is open. A tap on a reminder does nothing then, so it cannot
 * throw away what the user is typing. Forms built on FormModal keep this up to date.
 */
export const unsavedForm = { current: false };
