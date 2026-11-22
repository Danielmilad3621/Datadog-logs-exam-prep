import { z } from 'zod';
import type { Question } from './question-types';

export const difficulties = ['unrated', 'easy', 'medium', 'hard'] as const;
export const questionStatuses = ['draft', 'published', 'archived'] as const;
export type Difficulty = typeof difficulties[number];
export type Category = { code: string; domain: string; topic: string };
export type QuestionSet = { id: number; name: string; default_difficulty: Difficulty };
export type BankQuestion = Question & {
  categoryCode: string; setId: number | null; setName: string;
  difficulty: Difficulty; status: typeof questionStatuses[number];
  explanation: string; source: string; revision: number;
};
export const normalizePrompt = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const option = z.object({ key: z.string().regex(/^[A-Z]$/, 'Use one letter A–Z for each option'), text: z.string().trim().min(1).max(4000) });
export const questionInput = z.object({
  id: z.number().int().positive().optional(),
  revision: z.number().int().positive().optional(),
  prompt: z.string().trim().min(1, 'Enter a question').max(10000),
  options: z.array(option).min(2).max(12),
  answers: z.array(z.string()).min(1, 'Select the correct answer').max(12),
  type: z.enum(['single', 'multi', 'truefalse']),
  categoryCode: z.string().trim().min(1, 'Choose a category').max(30),
  setId: z.number().int().positive().nullable().default(null),
  difficulty: z.enum(difficulties).default('unrated'),
  status: z.enum(questionStatuses).default('draft'),
  explanation: z.string().trim().max(10000).default(''),
  source: z.string().trim().max(2000).default(''),
  sourcePage: z.number().int().min(0).max(100000).default(0),
  flags: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
}).superRefine((q, ctx) => {
  const keys = new Set(q.options.map(o => o.key));
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (keys.size !== q.options.length) fail('Option letters must be unique');
  if (new Set(q.answers).size !== q.answers.length || q.answers.some(a => !keys.has(a))) fail('Answers must refer to different existing options');
  if (q.type !== 'multi' && q.answers.length !== 1) fail('Single-answer and True/False questions need exactly one answer');
  if (q.type === 'multi' && q.answers.length < 2) fail('Multi-answer questions need at least two answers');
  if (q.type === 'truefalse' && (q.options.length !== 2 || !['true', 'false'].every(t => q.options.some(o => o.text.toLowerCase() === t)))) fail('True/False questions need True and False options');
  if (q.id && !q.revision) fail('Reload the question before editing it');
});
export type QuestionInput = z.infer<typeof questionInput>;
export const categoryInput = z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,29}$/, 'Use 2–30 uppercase letters, numbers, _ or -'),
  domain: z.string().trim().min(1).max(150), topic: z.string().trim().min(1).max(150),
});
export const setInput = z.object({ name: z.string().trim().min(1).max(150), defaultDifficulty: z.enum(difficulties) });
export const setDifficultyInput = z.object({ id: z.number().int().positive(), difficulty: z.enum(difficulties) });

// Parse quoted CSV cells, including escaped quotes and embedded newlines.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Malformed CSV quoting');
    else cell += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted cell');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  const header = rows.shift()?.map(s => s.trim()) ?? [];
  if (!header.length || new Set(header).size !== header.length || header.some(h => !h)) throw new Error('CSV needs unique, nonempty column headers');
  return rows.filter(r => r.some(v => v.trim())).map((r, i) => {
    if (r.length !== header.length) throw new Error('CSV row ' + (i + 2) + ' has the wrong number of columns');
    return Object.fromEntries(header.map((h, j) => [h, r[j] ?? '']));
  });
}
export type ImportDefaults = { categoryCode: string; setId: number | null; difficulty: Difficulty };
export function parseQuestionImport(text: string, format: 'json' | 'csv', defaults: ImportDefaults, categories: Category[], existing: { prompt: string }[]) {
  const parsed: unknown = format === 'csv' ? parseCsv(text) : JSON.parse(text);
  const rows: unknown = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('Import between 1 and 500 questions');
  const seen = new Set(existing.map(q => normalizePrompt(q.prompt)));
  return rows.map((value, index) => {
    try {
      if (!value || typeof value !== 'object') throw new Error('Expected a question object');
      const r = value as Record<string, unknown>;
      const options = Array.isArray(r['options']) ? r['options'] : 'ABCDEFGHIJKL'.split('').filter(k => r['option' + k]).map(key => ({ key, text: r['option' + key] }));
      const answers = typeof r['answers'] === 'string' ? r['answers'].split(/[|,]/).map(s => s.trim()).filter(Boolean) : r['answers'];
      const q = questionInput.parse({
        ...r, id: undefined, revision: undefined, options, answers,
        categoryCode: r['categoryCode'] || r['topicCode'] || defaults.categoryCode,
        difficulty: r['difficulty'] || defaults.difficulty, setId: defaults.setId,
        status: 'draft', sourcePage: Number(r['sourcePage'] || 0),
        flags: Array.isArray(r['flags']) ? r['flags'] : [],
      });
      if (!categories.some(c => c.code === q.categoryCode)) throw new Error('Unknown category code: ' + q.categoryCode);
      const prompt = normalizePrompt(q.prompt);
      if (seen.has(prompt)) throw new Error('This question already exists or is repeated in the file');
      seen.add(prompt);
      return q;
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues.map(i => i.message).join('; ') : error instanceof Error ? error.message : 'Invalid question';
      throw new Error('Question ' + (index + 1) + ': ' + message);
    }
  });
}
