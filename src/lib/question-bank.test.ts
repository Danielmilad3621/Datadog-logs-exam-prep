import { describe, expect, it } from 'vitest';
import bank from '@/data/questions.json';
import { parseCsv, parseQuestionImport, questionInput } from './question-bank';
const categories = [{ code: 'LA2', domain: 'Log Analysis', topic: 'Aggregations' }];
const defaults = { categoryCode: 'LA2', setId: 2, difficulty: 'hard' as const };
const q = { prompt: 'New unique question?', options: [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second' }], answers: ['A'], type: 'single', categoryCode: 'LA2' };
describe('question bank boundaries', () => {
  it('accepts every original question without changing its ID or correct answers', () => {
    for (const old of bank) {
      const parsed = questionInput.parse({ ...old, revision: 1, categoryCode: old.topicCode });
      expect(parsed.id).toBe(old.id); expect(parsed.answers).toEqual(old.answers);
    }
    expect(new Set(bank.map(q => q.id)).size).toBe(210);
  });
  it('rejects invalid answer keys and invalid answer counts', () => {
    expect(() => questionInput.parse({ ...q, answers: ['Z'] })).toThrow();
    expect(() => questionInput.parse({ ...q, answers: ['A', 'B'] })).toThrow();
    expect(() => questionInput.parse({ ...q, type: 'multi', answers: ['A'] })).toThrow();
    expect(() => questionInput.parse({ ...q, options: [{ key: 'A', text: 'a' }, { key: 'A', text: 'b' }] })).toThrow();
    expect(() => questionInput.parse({ ...q, type: 'truefalse' })).toThrow();
  });
  it('imports as drafts with fresh IDs and applies the selected set and defaults', () => {
    const [result] = parseQuestionImport(JSON.stringify([{ ...q, id: 1, revision: 5, status: 'published', setId: 99 }]), 'json', defaults, categories, []);
    expect(result).toMatchObject({ setId: 2, status: 'draft', difficulty: 'hard' });
    expect(result?.id).toBeUndefined(); expect(result?.revision).toBeUndefined();
  });
  it('refuses unknown categories and duplicate prompts even with different spacing/case', () => {
    expect(() => parseQuestionImport(JSON.stringify([{ ...q, categoryCode: 'X99' }]), 'json', defaults, categories, [])).toThrow(/Unknown category/);
    expect(() => parseQuestionImport(JSON.stringify([q]), 'json', defaults, categories, [{ prompt: ' NEW  unique question? ' }])).toThrow(/already exists/);
    expect(() => parseQuestionImport(JSON.stringify([q, q]), 'json', defaults, categories, [])).toThrow(/Question 2/);
  });
  it('parses quoted CSV and rejects malformed files', () => {
    const rows = parseCsv('\uFEFFprompt,explanation\r\n"Hello, ""world""","Line 1\nLine 2"\r\n');
    expect(rows).toEqual([{ prompt: 'Hello, "world"', explanation: 'Line 1\nLine 2' }]);
    expect(() => parseCsv('prompt,prompt\na,b')).toThrow(/unique/);
    expect(() => parseCsv('a,b\n"open,b')).toThrow(/unclosed/);
    expect(() => parseCsv('a,b\nx,y,z')).toThrow(/columns/);
  });
  it('imports multi-answer CSV and rejects a later invalid row', () => {
    const csv = 'prompt,type,optionA,optionB,optionC,answers\n"One, two?",multi,One,Two,Three,A|B\n';
    expect(parseQuestionImport(csv, 'csv', defaults, categories, [])[0]?.answers).toEqual(['A', 'B']);
    expect(() => parseQuestionImport(csv + 'Broken,single,A,B,C,Z\n', 'csv', defaults, categories, [])).toThrow(/Question 2/);
  });
});
