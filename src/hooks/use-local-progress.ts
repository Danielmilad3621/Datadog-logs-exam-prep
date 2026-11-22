import { useEffect, useState } from 'react';
import type { StudyProgress } from './use-cloud-progress';

export const LOCAL_PROGRESS_KEY = 'datadog-log-lab-progress-v1';
const empty = (): StudyProgress => ({ cards: {}, answers: {}, history: [] });

export function useLocalProgress() {
  const [progress, setProgress] = useState<StudyProgress>(empty);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading local progress');
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StudyProgress;
        if (!parsed?.cards || !parsed.answers || !Array.isArray(parsed.history)) throw new Error('Invalid progress');
        setProgress(parsed);
      }
      setCanSave(true);
    } catch {
      // Preserve an unreadable backup rather than overwriting it with empty data.
      setStatus('Local backup could not be read. Export this session before closing.');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !canSave) return;
    try {
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
      setStatus('Saved in this browser');
    } catch {
      setStatus('Browser storage unavailable. Export progress before closing.');
    }
  }, [progress, ready, canSave]);

  return { progress, setProgress, ready, status };
}
