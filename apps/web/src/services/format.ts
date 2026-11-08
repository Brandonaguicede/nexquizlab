/** "1 pregunta", "3 preguntas". The nouns used here pluralize with -s unless another plural is given. */
export const count = (value: number, singular: string, plural = singular + 's') => `${value} ${value === 1 ? singular : plural}`;
/** User-facing text of a failure: services already throw Spanish messages; anything else gets the fallback. */
export const messageOf = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;
