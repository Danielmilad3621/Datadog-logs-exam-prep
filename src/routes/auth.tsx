import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { isStudyAccount } from '@/lib/study-access';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Sign in | Log Lab' }, { name: 'robots', content: 'noindex' }] }),
  component: Auth,
});
function Auth() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const authError = params.get('error_description');
    if (authError) { setError(authError); window.history.replaceState(null, '', '/auth'); }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      if (isStudyAccount(data.user)) { await navigate({ to: '/study', replace: true }); }
      else { await supabase.auth.signOut(); if (active) setError('Please use danielmilad3621@gmail.com.'); }
    }).catch(() => { if (active) setError('Could not check your session. Please try again.'); });
    return () => { active = false; };
  }, [navigate]);
  async function signIn() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth', queryParams: { prompt: 'select_account', login_hint: 'danielmilad3621@gmail.com' } },
      });
      if (error) throw error;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false); }
  }
  return <main className="account-page"><div className="account-content"><img src="/icon.svg" width="64" height="64" alt="Log Lab" /><div className="eyebrow">YOUR PRIVATE STUDY SPACE</div><h1>Log Lab</h1><p>Datadog Log Management Fundamentals</p><p>Continue on any device with your saved progress.</p><Button className="google-signin" onClick={signIn} disabled={busy}>{busy ? 'Opening Google…' : 'Continue with Google'}</Button><small className="account-email">danielmilad3621@gmail.com</small>{error && <p role="alert" className="text-destructive mt-4">{error}</p>}</div></main>;
}
