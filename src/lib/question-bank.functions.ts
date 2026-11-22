import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { categoryInput, questionInput, setInput, setDifficultyInput } from './question-bank';
import type { BankQuestion, Category, Difficulty, QuestionInput, QuestionSet } from './question-bank';
import type { Database, Json } from '@/integrations/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function readQuestionBank(supabase: SupabaseClient<Database>, includeDrafts: boolean) {
  const [categoryResult, setResult] = await Promise.all([
    supabase.from('question_categories').select('*').order('domain').order('topic'),
    supabase.from('question_sets').select('*').order('name'),
  ]);
  if (categoryResult.error || setResult.error) throw new Error('Could not load question categories. Please retry.');
  const categories = categoryResult.data as Category[];
  const sets = setResult.data as QuestionSet[];
  const categoryMap = new Map(categories.map(c => [c.code, c]));
  const setMap = new Map(sets.map(s => [s.id, s]));
  const questions: BankQuestion[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('questions').select('*').order('id').range(offset, offset + 499);
    if (!includeDrafts) query = query.neq('status', 'draft');
    const { data, error } = await query;
    if (error) throw new Error('Could not load the question bank. Please retry.');
    for (const q of data) {
      const c = categoryMap.get(q.category_code);
      if (!c) throw new Error('Question category is missing');
      questions.push({
        id: q.id, prompt: q.prompt, options: q.options as BankQuestion['options'], answers: q.answers,
        type: q.type as BankQuestion['type'], domain: c.domain, topic: c.topic, topicCode: c.code,
        categoryCode: c.code, setId: q.set_id, setName: setMap.get(q.set_id ?? -1)?.name ?? '',
        sourcePage: q.source_page, flags: q.flags, difficulty: q.difficulty as Difficulty,
        status: q.status as BankQuestion['status'], explanation: q.explanation, source: q.source, revision: q.revision,
      });
    }
    if (data.length < 500) break;
  }
  return { categories, sets, questions };
}
export const getQuestionBank = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readQuestionBank(context.supabase, true));
function row(q: QuestionInput) {
  return { prompt: q.prompt, options: q.options as Json, answers: q.answers, type: q.type,
    category_code: q.categoryCode, set_id: q.setId, difficulty: q.difficulty, status: q.status,
    explanation: q.explanation, source: q.source, source_page: q.sourcePage, flags: q.flags };
}
function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23505') return 'This question, category, or set already exists.';
  if (error.code === '23503') return 'The selected category or set no longer exists. Reload and try again.';
  return 'Could not save changes. Reload and retry.';
}
export const saveQuestion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(questionInput).handler(async ({ context, data }) => {
    if (data.id) {
      const { data: saved, error } = await context.supabase.from('questions').update(row(data))
        .eq('id', data.id).eq('revision', data.revision!).select('id').maybeSingle();
      if (error) throw new Error(friendlyError(error));
      if (!saved) throw new Error('This question changed on another device. Reload it before saving.');
      return saved.id;
    }
    const { data: saved, error } = await context.supabase.from('questions').insert(row(data)).select('id').single();
    if (error) throw new Error(friendlyError(error));
    return saved.id;
  });
export const importQuestions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(z.array(questionInput).min(1).max(500)).handler(async ({ context, data }) => {
    // One insert is one database transaction: an invalid/duplicate row saves nothing.
    const { error } = await context.supabase.from('questions').insert(data.map(q => row({ ...q, status: 'draft' })));
    if (error) throw new Error(friendlyError(error));
    return data.length;
  });
export const saveCategory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(categoryInput).handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('question_categories').insert(data);
    if (error) throw new Error(friendlyError(error));
  });
export const saveQuestionSet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(setInput).handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('question_sets').insert({ name: data.name, default_difficulty: data.defaultDifficulty });
    if (error) throw new Error(friendlyError(error));
  });
export const applySetDifficulty = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(setDifficultyInput).handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc('set_question_set_difficulty', { target_set: data.id, new_difficulty: data.difficulty });
    if (error) throw new Error(friendlyError(error));
  });
export const publishQuestionSet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .validator(z.number().int().positive()).handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('questions').update({ status: 'published' }).eq('set_id', data).eq('status', 'draft');
    if (error) throw new Error(friendlyError(error));
  });
