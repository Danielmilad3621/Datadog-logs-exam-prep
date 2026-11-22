import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuestionManager } from './question-manager';
import * as api from '@/lib/question-bank.functions';
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('@/lib/question-bank.functions', () => ({
  getQuestionBank: vi.fn(), saveQuestion: vi.fn(), importQuestions: vi.fn(),
  saveCategory: vi.fn(), saveQuestionSet: vi.fn(), applySetDifficulty: vi.fn(), publishQuestionSet: vi.fn(),
}));
const initial = { categories: [{ code: 'LA2', domain: 'Log Analysis', topic: 'Aggregations' }], sets: [{ id: 1, name: 'Hard practice', default_difficulty: 'hard' as const }], questions: [] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getQuestionBank).mockResolvedValue(initial);
  vi.mocked(api.saveQuestion).mockResolvedValue(211);
  vi.mocked(api.importQuestions).mockResolvedValue(1);
});
it('saves a validated new question as a draft and uses the set difficulty', async () => {
  render(<QuestionManager initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: '+ New question' }));
  fireEvent.change(screen.getByLabelText('Question', { exact: true }), { target: { value: 'A new UI question?' } });
  for (const key of ['A', 'B', 'C']) fireEvent.change(screen.getByLabelText('Option ' + key, { exact: true }), { target: { value: 'Choice ' + key } });
  fireEvent.click(screen.getByLabelText('Option A is correct'));
  fireEvent.change(screen.getByLabelText('Question set', { exact: true }), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
  await waitFor(() => expect(api.saveQuestion).toHaveBeenCalledWith({ data: expect.objectContaining({
    prompt: 'A new UI question?', answers: ['A'], setId: 1, difficulty: 'hard', status: 'draft',
  }) }));
  expect(await screen.findByRole('status')).toHaveTextContent('Question saved');
});
it('requires explicit preview and save before importing a set', async () => {
  render(<QuestionManager initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: 'Import a set' }));
  fireEvent.change(screen.getByLabelText('Question set', { exact: true }), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Or paste CSV / JSON'), { target: { value: 'prompt,type,optionA,optionB,answers,categoryCode\nNew imported question?,single,Yes,No,A,LA2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validate & preview' }));
  expect(screen.getByText('1 valid questions — nothing saved yet')).toBeInTheDocument();
  expect(api.importQuestions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 drafts' }));
  await waitFor(() => expect(api.importQuestions).toHaveBeenCalledWith({ data: [expect.objectContaining({ setId: 1, status: 'draft', difficulty: 'hard' })] }));
});
