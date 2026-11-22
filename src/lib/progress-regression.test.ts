import { expect, it } from 'vitest';
import { recordAnswer } from './mistakes';
import { countAnsweredQuestions, recordProgressAnswers } from './answer-progress';
it('keeps personal hard marks through answering and preserves answer counts', () => {
  const original = { cards: {}, answers: { '1': { correct: 2, incorrect: 1 } }, history: [], hardQuestions: [1, 5] };
  const next = recordProgressAnswers(original, [{ id: 1, correct: true }]);
  expect(next.hardQuestions).toEqual([1, 5]);
  expect(next.answers['1']).toEqual({ correct: 3, incorrect: 1 });
  expect(countAnsweredQuestions([1, 2], next.answers, { '2': ['A'] })).toBe(2);
});
it('still clears mistakes only after two consecutive correct answers', () => {
  const wrong = recordAnswer({}, 1, false);
  const first = recordAnswer(wrong.deck, 1, true);
  expect(first.cleared).toBe(false);
  expect(recordAnswer(first.deck, 1, true)).toEqual({ deck: {}, cleared: true });
});
