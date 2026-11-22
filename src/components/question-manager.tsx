import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { z } from 'zod';
import { difficulties, parseQuestionImport, questionInput } from '@/lib/question-bank';
import type { BankQuestion, Difficulty, QuestionInput } from '@/lib/question-bank';
import { applySetDifficulty, getQuestionBank, importQuestions, publishQuestionSet, saveCategory, saveQuestion, saveQuestionSet } from '@/lib/question-bank.functions';

type Bank = Awaited<ReturnType<typeof getQuestionBank>>;
type Panel = 'questions' | 'import' | 'organize';
const messageOf = (e: unknown) => e instanceof z.ZodError ? e.issues.map(i => i.message).join('; ') : e instanceof Error ? e.message : 'Could not complete this action';
function download(name: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
const csvTemplate = 'prompt,type,optionA,optionB,optionC,answers,categoryCode,difficulty,explanation,source,sourcePage\n"Replace this sample with your question",single,"First option","Second option","Third option",A,LA2,hard,"Explain why A is correct","Your source",0\n';
export function QuestionManager({ initial }: { initial: Bank }) {
  const [bank, setBank] = useState(initial);
  const [panel, setPanel] = useState<Panel>('questions');
  const [draft, setDraft] = useState<QuestionInput | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [categoryCode, setCategoryCode] = useState('');
  const [setId, setSetId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('unrated');
  const [preview, setPreview] = useState<QuestionInput[] | null>(null);
  const [category, setCategory] = useState({ code: '', domain: '', topic: '' });
  const [newSet, setNewSet] = useState({ name: '', defaultDifficulty: 'unrated' as Difficulty });
  const [setChoices, setSetChoices] = useState<Record<number, Difficulty>>({});
  async function run(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); setBank(await getQuestionBank()); setNotice(success); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  const blank = (): QuestionInput => ({
    prompt: '', options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }],
    answers: [], type: 'single', categoryCode: bank.categories[0]?.code ?? '',
    setId: null, difficulty: 'unrated', status: 'draft', explanation: '', source: '', sourcePage: 0, flags: [],
  });
  function edit(q: BankQuestion) {
    setDraft({ ...q, options: q.options.map(o => ({ ...o })), answers: [...q.answers] });
    setPreviewQuestion(null); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function changeSet(value: string) {
    setSetId(value); setPreview(null);
    const selected = bank.sets.find(s => s.id === Number(value));
    if (selected) setDifficulty(selected.default_difficulty);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    await run(async () => { const valid = questionInput.parse(draft); await saveQuestion({ data: valid }); setDraft(null); },
      'Question saved. Published changes appear when you return to the study space.');
  }
  const list = bank.questions.filter(q => (status === 'all' || q.status === status) && (q.prompt + ' ' + q.id + ' ' + q.topic + ' ' + q.setName).toLowerCase().includes(search.toLowerCase()));
  const counts = { published: bank.questions.filter(q => q.status === 'published').length, draft: bank.questions.filter(q => q.status === 'draft').length };
  return <main className="content manager">
    <div className="manager-heading"><div><div className="eyebrow">YOUR QUESTION LIBRARY</div><h1>Manage questions</h1><p>Add, review and publish questions. Your study progress stays linked to the original question IDs.</p></div><Link to="/study" className="btn btn-outline">← Back to study</Link></div>
    <div className="manager-summary"><span><b>{counts.published}</b> published</span><span><b>{counts.draft}</b> drafts</span><span><b>{bank.sets.length}</b> question sets</span></div>
    <div className="manager-tabs" aria-label="Question management">
      {(['questions', 'import', 'organize'] as const).map(p => <button key={p} className={'btn ' + (panel === p ? 'btn-primary' : 'btn-outline')} onClick={() => { setPanel(p); setError(''); }}>{p === 'questions' ? 'Questions' : p === 'import' ? 'Import a set' : 'Categories & sets'}</button>)}
      <button className="btn btn-outline" onClick={() => download('log-lab-question-bank.json', JSON.stringify({ format: 'log-lab-question-bank-v1', questions: bank.questions }, null, 2))}>Export bank</button>
    </div>
    {error && <div className="manager-error" role="alert">{error}</div>}
    {notice && <div className="manager-success" role="status">{notice}</div>}
    {busy && <p role="status">Saving changes…</p>}

    {panel === 'questions' && <>
      {draft && <form className="setup-card manager-form" onSubmit={save}>
        <div className="manager-heading"><h2>{draft.id ? 'Edit question ' + draft.id : 'New question'}</h2><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setDraft(null)}>Close editor</button></div>
        <label>Question<textarea required maxLength={10000} value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} /></label>
        <div className="manager-grid">
          <label>Question type<select value={draft.type} onChange={e => { const type = e.target.value as QuestionInput['type']; setDraft({ ...draft, type, answers: [], options: type === 'truefalse' ? [{ key: 'A', text: 'False' }, { key: 'B', text: 'True' }] : draft.options }); }}><option value="single">One correct answer</option><option value="multi">Multiple correct answers</option><option value="truefalse">True / False</option></select></label>
          <label>Category<select required value={draft.categoryCode} onChange={e => setDraft({ ...draft, categoryCode: e.target.value })}>{bank.categories.map(c => <option key={c.code} value={c.code}>{c.domain} → {c.topic}</option>)}</select></label>
          <label>Question set<select value={draft.setId ?? ''} onChange={e => { const set = bank.sets.find(s => s.id === Number(e.target.value)); setDraft({ ...draft, setId: set?.id ?? null, difficulty: set?.default_difficulty ?? draft.difficulty }); }}><option value="">No set</option>{bank.sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Difficulty<select value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value as Difficulty })}>{difficulties.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
        </div>
        <fieldset><legend>Options — tick the correct answer{draft.type === 'multi' ? 's' : ''}</legend>{draft.options.map((o, index) => <div className="manager-option" key={o.key}>
          <label className="manager-correct"><input type="checkbox" aria-label={'Option ' + o.key + ' is correct'} checked={draft.answers.includes(o.key)} onChange={e => setDraft({ ...draft, answers: draft.type === 'multi' ? e.target.checked ? [...draft.answers, o.key] : draft.answers.filter(k => k !== o.key) : e.target.checked ? [o.key] : [] })} /><span>{o.key}</span></label>
          <input required aria-label={'Option ' + o.key} maxLength={4000} value={o.text} disabled={draft.type === 'truefalse'} onChange={e => setDraft({ ...draft, options: draft.options.map((x, i) => i === index ? { ...x, text: e.target.value } : x) })} />
        </div>)}
        {draft.type !== 'truefalse' && <div className="manager-actions"><button type="button" className="btn btn-outline" disabled={draft.options.length >= 12} onClick={() => setDraft({ ...draft, options: [...draft.options, { key: String.fromCharCode(65 + draft.options.length), text: '' }] })}>Add option</button><button type="button" className="btn btn-outline" disabled={draft.options.length <= 2} onClick={() => { const removed = draft.options.at(-1)?.key; setDraft({ ...draft, options: draft.options.slice(0, -1), answers: draft.answers.filter(a => a !== removed) }); }}>Remove last option</button></div>}</fieldset>
        <label>Explanation<textarea maxLength={10000} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></label>
        <div className="manager-grid"><label>Source / reference<input maxLength={2000} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} /></label><label>Source page (0 if not applicable)<input type="number" min={0} max={100000} value={draft.sourcePage} onChange={e => setDraft({ ...draft, sourcePage: Number(e.target.value) })} /></label></div>
        <label>Answer-key warnings (one per line)<textarea value={draft.flags.join('\n')} onChange={e => setDraft({ ...draft, flags: e.target.value.split('\n').filter(Boolean) })} /><small>Questions with warnings stay out of the mock exam. Use Difficulty for hard questions.</small></label>
        <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as QuestionInput['status'] })}>{(draft.id && bank.questions.find(q => q.id === draft.id)?.status !== 'draft' ? ['published', 'archived'] : ['draft', 'published']).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <p className="mini">Drafts stay out of study sessions. Archive a published question to stop new practice while preserving its ID and past progress.</p>
        <button className="btn btn-primary" disabled={busy}>Save question</button>
      </form>}
      <div className="manager-heading"><div className="manager-search"><label>Search questions<input placeholder="Question, ID, category or set" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{['draft', 'published', 'archived'].map(s => <option key={s}>{s}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy} onClick={() => { setDraft(blank()); setError(''); }}>+ New question</button></div>
      <p>{list.length} questions</p>
      <div className="manager-list">{list.map(q => <article className="manager-row" key={q.id}><div><div className="tag-row"><span className="tag">Q{q.id} · {q.status}</span><span className="tag muted">{q.difficulty}</span></div><h3>{q.prompt}</h3><p>{q.domain} → {q.topic}{q.setName ? ' · ' + q.setName : ''}</p></div><div className="manager-actions"><button className="btn btn-outline" onClick={() => setPreviewQuestion(previewQuestion?.id === q.id ? null : q)}>Preview</button><button className="btn btn-outline" disabled={busy} onClick={() => edit(q)}>Edit</button></div>{previewQuestion?.id === q.id && <div className="manager-preview"><ol>{q.options.map(o => <li key={o.key}>{o.key}. {o.text}{q.answers.includes(o.key) ? ' ✓ Correct' : ''}</li>)}</ol>{q.explanation && <p>{q.explanation}</p>}<p className="mini">{q.source}{q.sourcePage > 0 ? ' · Page ' + q.sourcePage : ''}</p></div>}</article>)}</div>
      {!list.length && <div className="empty">No questions match this filter.</div>}
    </>}

    {panel === 'import' && <div className="setup-card manager-form">
      <h2>Import questions as drafts</h2><p>1. Choose a set and defaults. 2. Upload your CSV or JSON. 3. Validate and review. 4. Save drafts, then publish the set when ready.</p>
      <button className="btn btn-outline" onClick={() => download('question-import-template.csv', csvTemplate, 'text/csv')}>Download CSV template</button>
      <div className="manager-grid">
        <label>Question set<select value={setId} onChange={e => changeSet(e.target.value)}><option value="">No set — publish individually</option>{bank.sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Default category (when missing in file)<select value={categoryCode} onChange={e => { setCategoryCode(e.target.value); setPreview(null); }}><option value="">Require a category in each row</option>{bank.categories.map(c => <option key={c.code} value={c.code}>{c.domain} → {c.topic} ({c.code})</option>)}</select></label>
        <label>Default difficulty<select value={difficulty} onChange={e => { setDifficulty(e.target.value as Difficulty); setPreview(null); }}>{difficulties.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>File format<select value={format} onChange={e => { setFormat(e.target.value as 'csv' | 'json'); setPreview(null); }}><option value="csv">CSV</option><option value="json">JSON</option></select></label>
      </div>
      <label>Upload file<input type="file" accept=".csv,.json,text/csv,application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setPreview(null); setError(''); if (file.size > 10 * 1024 * 1024) { setError('Choose a file smaller than 10 MB'); return; } try { setText(await file.text()); setFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv'); } catch { setError('Could not read this file'); } }} /></label>
      <label>Or paste CSV / JSON<textarea className="manager-import" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} /></label>
      <p className="mini">Up to 500 questions. CSV: prompt, type, optionA…optionL, answers (A|B), categoryCode, difficulty, explanation, source, sourcePage. JSON accepts an array or an exported bank. Imported IDs are ignored; existing questions are never overwritten.</p>
      <button className="btn btn-outline" disabled={busy || !text.trim()} onClick={() => { setError(''); setNotice(''); try { setPreview(parseQuestionImport(text, format, { categoryCode, setId: setId ? Number(setId) : null, difficulty }, bank.categories, bank.questions)); } catch (e) { setPreview(null); setError(messageOf(e)); } }}>Validate & preview</button>
      {preview && <><h3>{preview.length} valid questions — nothing saved yet</h3><div className="manager-import-preview">{preview.map((q, i) => <div key={i}><b>{i + 1}. {q.prompt}</b><p>{q.categoryCode} · {q.difficulty} · {q.answers.join(', ')} correct</p><ul>{q.options.map(o => <li key={o.key}>{o.key}. {o.text}{q.answers.includes(o.key) ? ' ✓' : ''}</li>)}</ul>{q.explanation && <p>{q.explanation}</p>}</div>)}</div><button className="btn btn-primary" disabled={busy} onClick={() => void run(async () => { await importQuestions({ data: preview }); setPreview(null); setText(''); }, 'Questions saved as drafts. Review them in Questions, then publish individually or from Categories & sets.')}>Save {preview.length} drafts</button></>}
    </div>}

    {panel === 'organize' && <div className="manager-organize">
      <section className="setup-card manager-form"><h2>Question sets</h2><p>A set groups one batch of questions. Its default difficulty is used when adding questions to it.</p>
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await saveQuestionSet({ data: newSet }); setNewSet({ name: '', defaultDifficulty: 'unrated' }); }, 'Question set created.'); }} className="manager-form">
          <label>New set name<input required maxLength={150} value={newSet.name} onChange={e => setNewSet({ ...newSet, name: e.target.value })} /></label>
          <label>Default difficulty<select value={newSet.defaultDifficulty} onChange={e => setNewSet({ ...newSet, defaultDifficulty: e.target.value as Difficulty })}>{difficulties.map(d => <option key={d}>{d}</option>)}</select></label><button disabled={busy} className="btn btn-primary">Create set</button>
        </form>
        {bank.sets.map(s => { const qs = bank.questions.filter(q => q.setId === s.id); const drafts = qs.filter(q => q.status === 'draft').length; return <div className="manager-set" key={s.id}><h3>{s.name}</h3><p>{qs.length} questions · {drafts} drafts</p><label>Set difficulty<select value={setChoices[s.id] ?? s.default_difficulty} onChange={e => setSetChoices({ ...setChoices, [s.id]: e.target.value as Difficulty })}>{difficulties.map(d => <option key={d}>{d}</option>)}</select></label><div className="manager-actions"><button className="btn btn-outline" disabled={busy} onClick={() => void run(() => applySetDifficulty({ data: { id: s.id, difficulty: setChoices[s.id] ?? s.default_difficulty } }), 'Difficulty updated for the set and all its questions.')}>Apply to all questions in set</button><button className="btn btn-primary" disabled={busy || !drafts} onClick={() => void run(() => publishQuestionSet({ data: s.id }), 'Set published. Return to study to see the new questions.')}>Publish {drafts} drafts</button></div></div>; })}
      </section>
      <section className="setup-card manager-form"><h2>Categories</h2><p>Choose existing categories when adding questions. Add a category here when you need a new topic.</p>
        <form onSubmit={e => { e.preventDefault(); void run(async () => { await saveCategory({ data: category }); setCategory({ code: '', domain: '', topic: '' }); }, 'Category added.'); }} className="manager-form">
          <label>Domain<input required list="existing-domains" maxLength={150} value={category.domain} onChange={e => setCategory({ ...category, domain: e.target.value })} /><datalist id="existing-domains">{[...new Set(bank.categories.map(c => c.domain))].map(d => <option key={d} value={d} />)}</datalist></label>
          <label>Topic<input required maxLength={150} value={category.topic} onChange={e => setCategory({ ...category, topic: e.target.value })} /></label>
          <label>Unique category code<input required placeholder="e.g. LA4" maxLength={30} value={category.code} onChange={e => setCategory({ ...category, code: e.target.value.toUpperCase() })} /></label>
          <button disabled={busy} className="btn btn-primary">Add category</button>
        </form>
        <div className="manager-category-list">{bank.categories.map(c => <p key={c.code}><b>{c.code}</b> {c.domain} → {c.topic}</p>)}</div>
      </section>
    </div>}
  </main>;
}
