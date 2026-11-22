import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudyApp from './study-app';
import type { StudyProgress } from '@/hooks/use-cloud-progress';
import type { Question } from '@/lib/question-types';
const original: Question = { id: 1, prompt: 'Original question', options: [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second' }], answers: ['A'], type: 'single', domain: 'Log Analysis', topic: 'Aggregations', topicCode: 'LA2', flags: [], sourcePage: 0, status: 'published' };
function Harness({ questions }: { questions: Question[] }) {
  const [progress, setProgress] = useState<StudyProgress>({ cards: {}, answers: {}, history: [] });
  return <><StudyApp questions={questions} progress={progress} setProgress={setProgress} accountControls={<span>Synced</span>} /><output data-testid="history">{JSON.stringify(progress.history)}</output></>;
}
beforeEach(() => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    key: index => [...values.keys()][index] ?? null,
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });
it('upgrades a legacy active quiz to a snapshot and keeps scoring stable after bank edits', async () => {
  window.localStorage.setItem('datadog-log-lab-current-quiz-v1', JSON.stringify({ mode: 'practice', ids: [1], index: 0, selections: { '1': ['A'] }, checked: [], flagged: [], startedAt: 1, endsAt: null, scoredIds: [1], finished: false }));
  const { rerender } = render(<Harness questions={[original]} />);
  fireEvent.click(screen.getAllByRole('button', { name: /Practice$/ })[0]!);
  expect(await screen.findByRole('heading', { name: 'Original question' })).toBeInTheDocument();
  rerender(<Harness questions={[{ ...original, prompt: 'Edited question', answers: ['B'] }]} />);
  expect(screen.getByRole('heading', { name: 'Original question' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finish & score' }));
  await waitFor(() => expect(JSON.parse(screen.getByTestId('history').textContent || '[]')[0]).toMatchObject({ correct: 1, scored: 1 }));
});

it('collapses and restores the workspace without losing the current question or answer', async () => {
  render(<Harness questions={[original]} />);
  fireEvent.click(screen.getAllByRole('button', { name: /Practice$/ })[0]!);
  fireEvent.click(screen.getByRole('button', { name: 'Start practice →' }));
  expect(await screen.findByRole('heading', { name: 'Original question' })).toBeInTheDocument();
  const answer = screen.getByRole('button', { name: 'A First' });
  fireEvent.click(answer);
  const hide = screen.getByRole('button', { name: 'Hide sidebar' });
  expect(hide).toHaveAttribute('aria-expanded', 'true');
  expect(hide).toHaveAttribute('aria-controls', 'workspace-sidebar');
  fireEvent.click(hide);
  const show = screen.getByRole('button', { name: 'Show sidebar' });
  expect(show).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById('workspace-sidebar')).not.toBeVisible();
  expect(document.querySelector('.shell')).toHaveClass('sidebar-collapsed');
  expect(screen.getByRole('heading', { name: 'Original question' })).toBeInTheDocument();
  expect(answer).toHaveClass('selected');
  fireEvent.click(show);
  expect(screen.getByRole('complementary', { name: 'Workspace' })).toBeVisible();
  expect(document.querySelector('.shell')).not.toHaveClass('sidebar-collapsed');
  expect(answer).toHaveClass('selected');
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByText('✓ Correct answer')).toBeInTheDocument();
});
