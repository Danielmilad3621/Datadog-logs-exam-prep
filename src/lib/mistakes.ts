export type MistakeEntry = { streak: number; addedAt: string; lastWrong: string };
export type MistakeDeck = Record<string, MistakeEntry>;

/** Correct answers in a row needed before a question leaves the deck. */
export const CLEAR_STREAK = 2;

/**
 * Apply one answer to the mistakes deck.
 * Wrong: add (or keep) the question and reset its streak.
 * Right: only matters if it's in the deck; after CLEAR_STREAK in a row it is removed.
 */
export function recordAnswer(
  deck: MistakeDeck,
  id: number | string,
  correct: boolean,
  now: string = new Date().toISOString(),
): { deck: MistakeDeck; cleared: boolean } {
  const key = String(id);
  const existing = deck[key];
  if (!correct) {
    return {
      deck: { ...deck, [key]: { streak: 0, addedAt: existing?.addedAt ?? now, lastWrong: now } },
      cleared: false,
    };
  }
  if (!existing) return { deck, cleared: false };
  const streak = existing.streak + 1;
  if (streak >= CLEAR_STREAK) {
    const next = { ...deck };
    delete next[key];
    return { deck: next, cleared: true };
  }
  return { deck: { ...deck, [key]: { ...existing, streak } }, cleared: false };
}
