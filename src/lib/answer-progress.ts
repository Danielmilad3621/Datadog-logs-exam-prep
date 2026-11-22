import type { StudyProgress } from '@/hooks/use-cloud-progress';

export function recordProgressAnswers(progress: StudyProgress, results: { id: number; correct: boolean }[]): StudyProgress {
  const answers = { ...progress.answers };
  for (const result of results) {
    const previous = answers[result.id] ?? { correct: 0, incorrect: 0 };
    answers[result.id] = {
      correct: previous.correct + Number(result.correct),
      incorrect: previous.incorrect + Number(!result.correct),
    };
  }
  return { ...progress, answers };
}

export function countAnsweredQuestions(ids: number[], answers: StudyProgress['answers'], selections: Record<string, string[]> = {}): number {
  return ids.filter(id => {
    const stat = answers[id];
    return (stat?.correct ?? 0) + (stat?.incorrect ?? 0) > 0 || (selections[id]?.length ?? 0) > 0;
  }).length;
}