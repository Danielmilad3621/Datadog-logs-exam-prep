'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Question } from './types';

type Tab = 'home' | 'cards' | 'practice' | 'exam' | 'progress';
type CardStat = { known: number; again: number; updated: string };
type AnswerStat = { correct: number; incorrect: number };
type Attempt = { id: string; mode: 'practice' | 'exam'; date: string; correct: number; total: number; scored: number; scoredTotal: number };
type Progress = { cards: Record<string, CardStat>; answers: Record<string, AnswerStat>; history: Attempt[] };
type Quiz = {
  mode: 'practice' | 'exam'; ids: number[]; index: number; selections: Record<string, string[]>;
  checked: number[]; flagged: number[]; startedAt: number; endsAt: number | null;
  scoredIds: number[]; finished: boolean;
};
const STORAGE = 'datadog-log-lab-progress-v1';
const SESSION = 'datadog-log-lab-current-quiz-v1';
const emptyProgress = (): Progress => ({ cards: {}, answers: {}, history: [] });
const shuffle = <T,>(array: T[]): T[] => {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const matches = (guess: string[], answers: string[]) =>
  guess.length === answers.length && guess.every(k => answers.includes(k));
const percent = (n: number, d: number) => d ? Math.round(100 * n / d) : 0;
const formatTime = (seconds: number) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function StudyApp({ questions }: { questions: Question[] }) {
  const [tab, setTab] = useState<Tab>('home');
  const [domain, setDomain] = useState('All domains');
  const [topic, setTopic] = useState('All topics');
  const [cardIndex, setCardIndex] = useState(0);
  const [cardOrder, setCardOrder] = useState<number[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [practiceSize, setPracticeSize] = useState(10);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showReview, setShowReview] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const qById = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const domains = useMemo(() => [...new Set(questions.map(q => q.domain))], [questions]);
  const topics = useMemo(() => [...new Set(questions.filter(q => domain === 'All domains' || q.domain === domain).map(q => q.topic))], [questions, domain]);
  const filtered = useMemo(() => questions.filter(q =>
    (domain === 'All domains' || q.domain === domain) && (topic === 'All topics' || q.topic === topic)), [questions, domain, topic]);
  const cards = useMemo(() => {
    const eligible = filtered.filter(q => !onlyMissed || (progress.cards[q.id]?.again ?? 0) > (progress.cards[q.id]?.known ?? 0));
    if (!cardOrder) return eligible;
    const index = new Map(cardOrder.map((id, i) => [id, i]));
    return [...eligible].sort((a, b) => (index.get(a.id) ?? 1e9) - (index.get(b.id) ?? 1e9));
  }, [filtered, onlyMissed, progress.cards, cardOrder]);
  const safeIndex = Math.min(cardIndex, Math.max(0, cards.length - 1));
  const currentCard = cards[safeIndex];
  const eligibleExam = useMemo(() => questions.filter(q => q.type === 'single' && q.options.length >= 3 && q.flags.length === 0), [questions]);
  const reviewedCount = Object.keys(progress.cards).length;
  const questionsAttempted = Object.keys(progress.answers).length;
  const quizQ = quiz ? qById.get(quiz.ids[quiz.index]) : undefined;
  const isChecked = quiz && quizQ ? quiz.checked.includes(quizQ.id) : false;
  const selection = quiz && quizQ ? quiz.selections[quizQ.id] || [] : [];
  const timer = quiz?.endsAt ? Math.max(0, Math.ceil((quiz.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved) as Progress;
        if (parsed.cards && parsed.answers && Array.isArray(parsed.history)) setProgress(parsed);
      }
      const session = window.localStorage.getItem(SESSION);
      if (session) {
        const parsed = JSON.parse(session) as Quiz;
        if (Array.isArray(parsed.ids) && parsed.ids.every(id => qById.has(id))) setQuiz(parsed);
      }
    } catch (e) { console.warn('Could not restore saved study data:', e); }
    setLoaded(true);
  }, [qById]);
  useEffect(() => { if (loaded) window.localStorage.setItem(STORAGE, JSON.stringify(progress)); }, [progress, loaded]);
  useEffect(() => { if (loaded) {
    if (quiz && !quiz.finished) window.localStorage.setItem(SESSION, JSON.stringify(quiz));
    else window.localStorage.removeItem(SESSION);
  } }, [quiz, loaded]);
  useEffect(() => {
    if (quiz?.endsAt && !quiz.finished) {
      const timerId = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(timerId);
    }
  }, [quiz?.endsAt, quiz?.finished]);

  const finishQuiz = useCallback(() => {
    if (!quiz || quiz.finished) return;
    const scored = quiz.mode === 'exam' ? quiz.scoredIds : quiz.ids;
    const correctScored = scored.filter(id => matches(quiz.selections[id] || [], qById.get(id)?.answers || [])).length;
    const correctAll = quiz.ids.filter(id => matches(quiz.selections[id] || [], qById.get(id)?.answers || [])).length;
    setProgress(p => {
      const answers = { ...p.answers };
      for (const id of quiz.ids) {
        const old = answers[id] || { correct: 0, incorrect: 0 };
        const correct = matches(quiz.selections[id] || [], qById.get(id)?.answers || []);
        answers[id] = { correct: old.correct + Number(correct), incorrect: old.incorrect + Number(!correct) };
      }
      const entry: Attempt = {
        id: String(quiz.startedAt), mode: quiz.mode, date: new Date().toISOString(),
        correct: correctAll, total: quiz.ids.length, scored: correctScored, scoredTotal: scored.length
      };
      return { ...p, answers, history: [entry, ...p.history].slice(0, 50) };
    });
    setQuiz(q => q && q.startedAt === quiz.startedAt ? { ...q, finished: true } : q);
    setShowReview(false);
  }, [quiz, qById]);
  useEffect(() => { if (quiz?.mode === 'exam' && !quiz.finished && quiz.endsAt && now >= quiz.endsAt) finishQuiz(); }, [quiz, now, finishQuiz]);

  function setFilters(nextDomain: string, nextTopic = 'All topics') {
    setDomain(nextDomain); setTopic(nextTopic); setCardIndex(0); setCardOrder(null); setFlipped(false);
  }
  function startQuiz(mode: 'practice' | 'exam') {
    const pool = mode === 'exam' ? eligibleExam : filtered;
    const ids = shuffle(pool.map(q => q.id)).slice(0, mode === 'exam' ? 90 : practiceSize);
    if (!ids.length) return;
    const nowTime = Date.now();
    setQuiz({ mode, ids, index: 0, selections: {}, checked: [], flagged: [],
      startedAt: nowTime, endsAt: mode === 'exam' ? nowTime + 120 * 60 * 1000 : null,
      scoredIds: mode === 'exam' ? shuffle(ids).slice(0, 75) : ids, finished: false });
    setNow(nowTime); setShowReview(false); setTab(mode === 'exam' ? 'exam' : 'practice');
  }
  function updateChoice(key: string) {
    if (!quiz || !quizQ || quiz.finished || isChecked) return;
    const current = quiz.selections[quizQ.id] || [];
    const next = quizQ.type === 'multi' ? (current.includes(key) ? current.filter(k => k !== key) : [...current, key]) : [key];
    setQuiz(q => q ? { ...q, selections: { ...q.selections, [quizQ.id]: next } } : q);
  }
  function markCard(known: boolean) {
    if (!currentCard) return;
    setProgress(p => {
      const existing = p.cards[currentCard.id] || { known: 0, again: 0, updated: '' };
      return { ...p, cards: { ...p.cards, [currentCard.id]: {
        ...existing, [known ? 'known' : 'again']: existing[known ? 'known' : 'again'] + 1,
        updated: new Date().toISOString()
      } } };
    });
    setFlipped(false);
    setCardIndex(i => cards.length ? (i + 1) % cards.length : 0);
  }
  function exportProgress() {
    const payload = JSON.stringify({ format: 'datadog-log-lab-progress-v1', data: progress }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'log-lab-progress.json'; a.click();
    URL.revokeObjectURL(url);
  }
  async function importProgress(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const body = JSON.parse(await file.text());
      const data = body.data as Progress;
      if (!data || typeof data.cards !== 'object' || typeof data.answers !== 'object' || !Array.isArray(data.history))
        throw new Error('Not a Log Lab progress export');
      if (window.confirm('Replace current progress with the selected backup?')) setProgress(data);
    } catch (err) { window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`); }
    e.target.value = '';
  }
  const label = (q: Question) => q.type === 'multi' ? 'Select all correct answers' : q.type === 'truefalse' ? 'True or False' : 'Select one answer';
  const answerDisplay = (q: Question) => q.options.filter(o => q.answers.includes(o.key)).map(o => `${o.key}. ${o.text}`).join(' • ');
  const historyBest = progress.history.filter(a => a.mode === 'exam').map(a => percent(a.scored, a.scoredTotal)).reduce((a, b) => Math.max(a, b), 0);
  const nav = [
    { id: 'home', name: 'Overview', mark: '▦' },
    { id: 'cards', name: 'Flashcards', mark: '▤' },
    { id: 'practice', name: 'Practice', mark: '◉' },
    { id: 'exam', name: 'Mock exam', mark: '◷' },
    { id: 'progress', name: 'Progress', mark: '↗' },
  ] as const;
  const reviewList = quiz ? quiz.ids.filter(id => !matches(quiz.selections[id] || [], qById.get(id)?.answers || [])) : [];
  const scoredSet = new Set(quiz?.scoredIds || []);
  const scoredCorrect = quiz?.scoredIds.filter(id => matches(quiz.selections[id] || [], qById.get(id)?.answers || [])).length || 0;
  const allCorrect = quiz?.ids.filter(id => matches(quiz.selections[id] || [], qById.get(id)?.answers || [])).length || 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo"><span className="logo-mark">◈</span><div><b>LOG LAB</b><small>Fundamentals prep</small></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>{nav.map(n => <button key={n.id} className={`nav-item ${tab === n.id ? 'nav-active' : ''}`} onClick={() => setTab(n.id)}><span className="nav-symbol">{n.mark}</span>{n.name}{n.id === 'exam' && quiz?.mode === 'exam' && !quiz.finished && <i className="live-dot" />}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="tiny-label">YOUR QUESTION BANK</div>
          <div className="bank-count"><b>{questions.length}</b><span>total questions</span></div>
          <div className="small-meter"><div style={{width:`${percent(reviewedCount,questions.length)}%`}} /></div>
          <small>{reviewedCount} flashcards reviewed</small>
          <div className="safety-note">Private practice • Third-party answers are not verified by Datadog.</div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><span className="breadcrumb">STUDY SPACE <span>/</span> {nav.find(n => n.id === tab)?.name.toUpperCase()}</span><span className="status"><i /> LOCAL PROGRESS</span></div>
        {tab === 'home' && <div className="content">
          <div className="hero"><div className="eyebrow">YOUR CERTIFICATION STUDY COMPANION</div><h1>Master Datadog logs.<br/><span>One question at a time.</span></h1><p>Review the imported practice bank, build confidence by domain, and sit a timed exam simulation when you&apos;re ready.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => setTab('cards')}>Study flashcards <span>↗</span></button><button className="btn btn-light" onClick={() => setTab('exam')}>Mock exam</button></div></div>
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-label">QUESTION BANK</div><b>{questions.length}</b><span>Questions imported</span></div>
            <div className="metric-card"><div className="metric-label">REVIEWED CARDS</div><b>{reviewedCount}</b><span>of {questions.length} cards</span></div>
            <div className="metric-card"><div className="metric-label">QUESTIONS ATTEMPTED</div><b>{questionsAttempted}</b><span>Unique questions</span></div>
            <div className="metric-card"><div className="metric-label">BEST MOCK SCORE</div><b>{historyBest ? `${historyBest}%` : '—'}</b><span>of simulated scored items</span></div>
          </div>
          <div className="section-heading"><div><h2>Study by exam domain</h2><p>Categories follow the exam guide; additional topics are kept separate.</p></div><button className="small-link" onClick={() => setTab('practice')}>Practice a topic →</button></div>
          <div className="domain-grid">{domains.map((d, i) => {
            const domainQuestions = questions.filter(q => q.domain === d);
            const seen = domainQuestions.filter(q => progress.cards[q.id] || progress.answers[q.id]).length;
            return <button key={d} className="domain-card" onClick={() => { setFilters(d); setTab('cards'); }}><div className="domain-top"><span className={`domain-icon domain-${i}`}>{['◈','⟁','⌕','▥','◷','⛭','＋'][i]}</span><span>{domainQuestions.length} Qs</span></div><h3>{d}</h3><div className="domain-progress"><span><b>{seen}</b> / {domainQuestions.length} explored</span><span>{percent(seen, domainQuestions.length)}%</span></div><div className="small-meter"><div style={{ width: `${percent(seen, domainQuestions.length)}%` }} /></div></button>;
          })}</div>
          <div className="footnote">This is an independent learning tool, not an official Datadog exam or an accurate predictor of your actual score.</div>
        </div>}

        {tab === 'cards' && <div className="content"><div className="page-head"><div className="eyebrow">ACTIVE RECALL</div><h1>Flashcards</h1><p>Flip to reveal the source answer, then mark whether you knew it.</p></div>
          <div className="filters"><label>Exam domain<select value={domain} onChange={e => setFilters(e.target.value)}><option>All domains</option>{domains.map(x => <option key={x}>{x}</option>)}</select></label><label>Subtopic<select value={topic} onChange={e => setFilters(domain,e.target.value)}><option>All topics</option>{topics.map(x => <option key={x}>{x}</option>)}</select></label><label className="check-filter"><input type="checkbox" checked={onlyMissed} onChange={e => { setOnlyMissed(e.target.checked); setCardIndex(0); setFlipped(false); }}/> Review difficult cards</label><button className="btn btn-outline" onClick={() => {setCardOrder(shuffle(filtered.map(q => q.id)));setCardIndex(0);setFlipped(false);}}>Shuffle ↝</button></div>
          {currentCard ? <div className="card-area"><div className="card-meta"><span>FLASHCARD {safeIndex+1} OF {cards.length}</span><span>PDF Q{currentCard.id} · Page {currentCard.sourcePage}</span></div><div className="flashcard"><div className="tag-row"><span className="tag">{currentCard.domain}</span><span className="tag muted">{currentCard.topic}</span></div><p className="mini">{flipped ? 'ANSWER' : 'QUESTION'}</p><h2>{flipped ? answerDisplay(currentCard) : currentCard.prompt}</h2>{!flipped && <div className="option-mini">{currentCard.options.map(o => <div key={o.key}><span>{o.key}</span>{o.text}</div>)}</div>}{flipped && <div className="answer-box"><span>From your uploaded PDF</span><p>{currentCard.flags.length ? `⚠ ${currentCard.flags.join('; ')}. Please verify this answer.` : 'Check the official Datadog documentation if an answer looks questionable.'}</p></div>}</div><div className="card-actions">{!flipped ? <button className="btn btn-primary large" onClick={() => setFlipped(true)}>Reveal answer <span>↗</span></button> : <><button className="btn btn-warn" onClick={() => markCard(false)}>↺ Review again</button><button className="btn btn-success" onClick={() => markCard(true)}>✓ I knew this</button></>}<button className="btn btn-outline" onClick={() => {setFlipped(false);setCardIndex(i => (i+1)%cards.length);}}>Skip →</button></div></div> : <div className="empty">No cards match this filter. Turn off “Review difficult cards” or choose another topic.</div>}
        </div>}

        {tab === 'practice' && (!quiz || quiz.mode !== 'practice') && <div className="content"><div className="page-head"><div className="eyebrow">LOW PRESSURE · IMMEDIATE FEEDBACK</div><h1>Topic practice</h1><p>Answer questions from any topic, including multi-select and True/False items from your PDF.</p></div><div className="setup-card"><h2>Build your practice set</h2><div className="filters"><label>Exam domain<select value={domain} onChange={e => setFilters(e.target.value)}><option>All domains</option>{domains.map(x => <option key={x}>{x}</option>)}</select></label><label>Subtopic<select value={topic} onChange={e => setFilters(domain,e.target.value)}><option>All topics</option>{topics.map(x => <option key={x}>{x}</option>)}</select></label><label>Questions<select value={practiceSize} onChange={e => setPracticeSize(Number(e.target.value))}>{[10,20,30,50].map(n => <option value={n} key={n}>{n}</option>)}</select></label></div><div className="setup-summary"><div><strong>{filtered.length}</strong> questions available for this selection</div><span>Answers are revealed after each question</span></div><button className="btn btn-primary large" disabled={!filtered.length} onClick={() => startQuiz('practice')}>Start practice →</button></div></div>}

        {tab === 'exam' && (!quiz || quiz.mode !== 'exam') && <div className="content"><div className="page-head"><div className="eyebrow">EXAM CONDITIONS</div><h1>Full mock exam</h1><p>A timed simulation designed around the format you supplied from Datadog&apos;s exam guide.</p></div><div className="exam-intro"><div className="exam-intro-top"><span className="exam-icon">◷</span><span className="badge">EXAM SIMULATION</span></div><h2>Ready to test yourself?</h2><div className="exam-metrics"><div><b>90</b><span>questions</span></div><div><b>120</b><span>minutes</span></div><div><b>75</b><span>scored*</span></div><div><b>15</b><span>unscored*</span></div></div><p>Uses {eligibleExam.length} eligible, single-correct-answer multiple-choice questions from the PDF. No answers appear until you finish. You can skip, flag, and revisit questions.</p><div className="info-box">* The 15 unscored items are selected randomly by this app for practice. They are <strong>not</strong> Datadog&apos;s real pretest items, and this is not an official score prediction.</div><button className="btn btn-primary large" disabled={eligibleExam.length < 90} onClick={() => startQuiz('exam')}>Begin 90-question mock →</button></div></div>}

        {quiz && !quiz.finished && ((quiz.mode === 'exam' && tab === 'exam') || (quiz.mode === 'practice' && tab === 'practice')) && quizQ && <div className="content quiz-content"><div className="quiz-top"><div><div className="eyebrow">{quiz.mode === 'exam' ? 'TIMED MOCK EXAM' : 'TOPIC PRACTICE'}</div><h1>Question {quiz.index+1} <span className="subdued">/ {quiz.ids.length}</span></h1></div>{quiz.mode === 'exam' && <div className={`countdown ${timer < 600 ? 'countdown-low' : ''}`}>◷ {formatTime(timer)}</div>}</div><div className="quiz-meter"><div style={{ width: `${percent(quiz.index+1,quiz.ids.length)}%` }} /></div><div className="quiz-columns"><div className="question-box"><div className="question-top"><span className="tag">{quizQ.domain}</span><span className="pill">{label(quizQ)}</span></div><div className="question-sub">{quizQ.topic} • Source Q{quizQ.id}</div><h2>{quizQ.prompt}</h2><div className="answer-options">{quizQ.options.map(o => {
                  const chosen = selection.includes(o.key);const correct = isChecked && quizQ.answers.includes(o.key);
                  return <button key={o.key} disabled={!!isChecked} className={`answer-option ${chosen ? 'selected' : ''} ${correct ? 'correct' : ''} ${isChecked && chosen && !correct ? 'incorrect' : ''}`} onClick={() => updateChoice(o.key)}><span className="option-letter">{o.key}</span><span>{o.text}</span><span className="option-indicator">{chosen ? '✓' : ''}</span></button>;
                })}</div>{isChecked && <div className={`feedback ${matches(selection,quizQ.answers) ? 'good' : 'bad'}`}><b>{matches(selection,quizQ.answers) ? '✓ Correct answer' : '✕ Not quite'}</b><p>Source key: {answerDisplay(quizQ)}</p>{quizQ.flags.length>0 && <p className="flag-warning">⚠ Answer key issue: {quizQ.flags.join(', ')}</p>}</div>}
                <div className="quiz-actions"><button className="btn btn-outline" disabled={quiz.index===0} onClick={() => setQuiz(q => q ? {...q,index:q.index-1}:q)}>← Previous</button><div className="action-end">{quiz.mode === 'exam' && <button className="btn btn-outline" onClick={() => setQuiz(q => q ? {...q,flagged:q.flagged.includes(quizQ.id)?q.flagged.filter(x=>x!==quizQ.id):[...q.flagged,quizQ.id]}:q)}>{quiz.flagged.includes(quizQ.id)?'⚑ Flagged':'⚑ Flag for review'}</button>}{quiz.mode === 'practice' && !isChecked && <button className="btn btn-primary" disabled={!selection.length} onClick={() => setQuiz(q => q ? {...q,checked:[...q.checked,quizQ.id]}:q)}>Check answer</button>}{(quiz.mode==='exam'||isChecked) && (quiz.index+1 < quiz.ids.length ? <button className="btn btn-primary" onClick={() => setQuiz(q => q?{...q,index:q.index+1}:q)}>Next question →</button> : <button className="btn btn-primary" onClick={() => {if (window.confirm('Finish and score this session now?')) finishQuiz();}}>Finish & score →</button>)}</div></div>
              </div><div className="question-sidebar"><h3>Question navigator</h3><p>{Object.values(quiz.selections).filter(a=>a.length).length} answered · {quiz.ids.length} total</p><div className="number-grid">{quiz.ids.map((id,i)=><button key={id} title={`Question ${i+1}`} className={`${i===quiz.index?'current':''} ${quiz.selections[id]?.length?'answered':''} ${quiz.flagged.includes(id)?'flagged':''}`} onClick={() => setQuiz(q=>q?{...q,index:i}:q)}>{i+1}</button>)}</div><div className="nav-legend"><span><i className="leg-answered"/> Answered</span><span><i className="leg-flagged"/> Flagged</span></div><button className="btn btn-outline finish" onClick={() => { if (window.confirm('Finish and score your session now?')) finishQuiz(); }}>Finish & score</button></div></div></div>}

        {quiz?.finished && (tab === (quiz.mode === 'exam' ? 'exam' : 'practice')) && <div className="content results"><div className="eyebrow">SESSION COMPLETE</div><h1>Your {quiz.mode==='exam'?'mock exam':'practice'} results</h1><p>Here&apos;s how you did against the uploaded answer keys.</p><div className="results-card"><div className="result-ring" style={{background:`conic-gradient(#3c78f3 ${percent(quiz.mode==='exam'?scoredCorrect:allCorrect,quiz.mode==='exam'?75:quiz.ids.length)}%, #e8edf4 0)`}}><b>{percent(quiz.mode==='exam'?scoredCorrect:allCorrect,quiz.mode==='exam'?75:quiz.ids.length)}%</b><span>{quiz.mode==='exam'?'Simulated score':'Practice score'}</span></div><div className="results-details"><h2>{quiz.mode==='exam'?'Simulated scoring':'Practice complete'}</h2><p><b>{quiz.mode==='exam'?scoredCorrect:allCorrect}</b> correct out of <b>{quiz.mode==='exam'?75:quiz.ids.length}</b> counted items</p>{quiz.mode==='exam' && <p>Raw result: <b>{allCorrect}/{quiz.ids.length}</b> across all 90 practice questions.</p>}<p>{reviewList.length} incorrect or unanswered questions to review.</p></div></div><div className="info-box">This is a third-party question bank with at least one inconsistent answer key. Datadog does not publish an official passing score, so this app cannot determine whether you would pass.</div><div className="result-actions"><button className="btn btn-primary" onClick={() => setShowReview(!showReview)}>{showReview?'Hide wrong answers':'Review wrong answers'} ({reviewList.length})</button><button className="btn btn-outline" onClick={() => {setQuiz(null);setTab('cards');}}>Back to flashcards</button><button className="btn btn-light" onClick={() => setQuiz(null)}>New session</button></div>{showReview && <div className="review-stack">{reviewList.map(id => {const q=qById.get(id)!;return <article className="review-item" key={id}><div className="question-sub">Q{id} · {q.topic}{quiz.mode==='exam' && !scoredSet.has(id)?' · Simulated unscored':''}</div><h3>{q.prompt}</h3><p><strong>Your answer:</strong> {quiz.selections[id]?.join(', ') || 'Unanswered'}</p><p><strong>Source answer:</strong> {answerDisplay(q)}</p></article>})}</div>}</div>}

        {tab === 'progress' && <div className="content"><div className="page-head"><div className="eyebrow">YOUR LEARNING DATA</div><h1>Progress & history</h1><p>Saved in this browser. Export a backup to transfer your progress to another device.</p></div><div className="metric-grid"><div className="metric-card"><div className="metric-label">CARDS SEEN</div><b>{reviewedCount}</b><span>unique flashcards</span></div><div className="metric-card"><div className="metric-label">QUESTIONS ATTEMPTED</div><b>{questionsAttempted}</b><span>unique questions</span></div><div className="metric-card"><div className="metric-label">SESSIONS</div><b>{progress.history.length}</b><span>practice + mock exams</span></div><div className="metric-card"><div className="metric-label">BEST MOCK</div><b>{historyBest?`${historyBest}%`:'—'}</b><span>simulated score</span></div></div><div className="section-heading"><div><h2>Recent sessions</h2><p>Most recent first.</p></div></div>{progress.history.length?<div className="history">{progress.history.map(h=><div className="history-row" key={h.id}><span className="history-mode">{h.mode==='exam'?'◷ Mock exam':'◉ Practice'}</span><span>{new Date(h.date).toLocaleString()}</span><strong>{percent(h.scored,h.scoredTotal)}% <small>({h.scored}/{h.scoredTotal})</small></strong></div>)}</div>:<div className="empty">No completed sessions yet. Finish a quiz and your results will appear here.</div>}<div className="setup-card"><h2>Transfer your progress</h2><p>Export a JSON backup, then import it in another browser. No cloud sync or account is required.</p><div className="result-actions"><button className="btn btn-primary" onClick={exportProgress}>↓ Export progress</button><button className="btn btn-outline" onClick={() => importRef.current?.click()}>↑ Import progress</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importProgress}/></div></div></div>}
      </main>
    </div>
  );
}
