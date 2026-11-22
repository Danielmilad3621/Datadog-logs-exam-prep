import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type StudyProgress = { hardQuestions?: number[]; cards: Record<string, { known: number; again: number; updated: string }>; answers: Record<string, { correct: number; incorrect: number }>; history: { id: string; mode: 'practice' | 'exam'; date: string; correct: number; total: number; scored: number; scoredTotal: number }[]; mistakes?: import('@/lib/mistakes').MistakeDeck; cleared?: { id: number; date: string }[] };
const empty = (): StudyProgress => ({ cards: {}, answers: {}, history: [] });
function valid(value: unknown): value is StudyProgress {
  if (!value || typeof value !== 'object') return false;
  const p = value as StudyProgress;
  return Boolean(p.cards && p.answers && Array.isArray(p.history));
}
export function useCloudProgress(userId: string) {
  const [progress, setProgress] = useState<StudyProgress>(empty);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading progress');
  const [retryTick, setRetryTick] = useState(0);
  const [conflict, setConflict] = useState<{ remote: StudyProgress; revision: number } | null>(null);
  const revision = useRef(0);
  const saved = useRef('');
  const current = useRef(progress);
  current.current = progress;
  const busy = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setRetryTick(t => t + 1), 3000);
    return () => clearInterval(timer);
  }, []);
  const cacheKey = `log-lab-cloud-progress-${userId}`;
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('study_progress').select('progress,revision').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return { remote: valid(data?.progress) ? data.progress : empty(), revision: data?.revision ?? 0 };
  }, [userId]);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const row = await load();
        if (!active) return;
        let local: StudyProgress | undefined;
        let localRevision = 0;
        let pending = false;
        try {
          const cache = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (valid(cache?.progress)) { local = cache.progress; localRevision = cache.revision; pending = cache.pending; }
          else {
            const legacy = JSON.parse(localStorage.getItem('datadog-log-lab-progress-v1') || 'null');
            if (valid(legacy) && (Object.keys(legacy.cards).length || Object.keys(legacy.answers).length || legacy.history.length || Object.keys(legacy.mistakes ?? {}).length)) { local = legacy; pending = true; }
          }
        } catch { /* A damaged cache never replaces cloud data. */ }
        revision.current = row.revision;
        saved.current = JSON.stringify(row.remote);
        if (local && pending) {
          setProgress(local);
          if (row.revision !== localRevision) { setConflict(row); setStatus('Choose progress to keep'); }
          else { setReady(true); setStatus('Saving'); }
        } else { setProgress(row.remote); setReady(true); setStatus('Synced'); }
      } catch { if (active) setStatus('Could not load progress. Refresh to retry.'); }
    }
    void restore();
    return () => { active = false; };
  }, [cacheKey, load]);

  useEffect(() => {
    if (!ready || conflict) return;
    const json = JSON.stringify(progress);
    localStorage.setItem(cacheKey, JSON.stringify({ progress, revision: revision.current, pending: json !== saved.current }));
    if (json === saved.current) return;
    setStatus('Saving');
    const timer = window.setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { data, error } = await supabase.rpc('save_study_progress', { payload: JSON.parse(json) as Json, expected_revision: revision.current });
        if (error) {
          if (error.message.includes('SYNC_CONFLICT')) { setConflict(await load()); setReady(false); setStatus('Choose progress to keep'); }
          else throw error;
        } else {
          revision.current = data;
          saved.current = json;
          localStorage.setItem(cacheKey, JSON.stringify({ progress: current.current, revision: data, pending: JSON.stringify(current.current) !== json }));
          setStatus(JSON.stringify(current.current) === json ? 'Synced' : 'Saving');
        }
      } catch { setStatus('Saved on this device • retrying'); }
      finally { busy.current = false; }
    }, 500);
    return () => clearTimeout(timer);
  }, [progress, ready, conflict, cacheKey, load, retryTick]);

  useEffect(() => {
    if (!ready || conflict) return;
    async function refresh() {
      if (busy.current || JSON.stringify(current.current) !== saved.current) return;
      busy.current = true;
      try {
        const row = await load();
        if (JSON.stringify(current.current) !== saved.current) return;
        if (row.revision !== revision.current) { revision.current = row.revision; saved.current = JSON.stringify(row.remote); setProgress(row.remote); }
      } catch { /* Keep last successfully loaded data. */ }
      finally { busy.current = false; }
    }
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [ready, conflict, load]);

  function resolve(useCloud: boolean) {
    if (!conflict) return;
    revision.current = conflict.revision;
    saved.current = JSON.stringify(conflict.remote);
    if (useCloud) setProgress(conflict.remote);
    setConflict(null); setReady(true); setStatus(useCloud ? 'Synced' : 'Saving');
  }
  return { progress, setProgress, ready, status, conflict, resolve };
}