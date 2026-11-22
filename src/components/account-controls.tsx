import { useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, UserRound, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export function AccountControls({ account, status }: { account: { userId: string; profile: { display_name: string; avatar_url: string } }; status: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.profile.display_name);
  const [message, setMessage] = useState('');
  async function signOut() {
    if (status !== 'Synced' && !window.confirm('Your latest progress is still saved on this device. Sign out before it finishes syncing?')) return;
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage('Could not sign out. Please retry.'); return; }
    await navigate({ to: '/auth', replace: true });
  }
  async function save() {
    const { error } = await supabase.from('profiles').update({ display_name: name.trim().slice(0, 100) }).eq('id', account.userId);
    setMessage(error ? 'Could not save your profile.' : 'Profile saved');
    if (!error) await router.invalidate();
  }
  return <div className="account-toolbar"><span className="sync-status" role="status">{status}</span><Button variant="ghost" size="icon" aria-label="Your profile" title="Your profile" onClick={() => setOpen(!open)}><UserRound /></Button><Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut /></Button>{open && <div className="account-menu"><h3>Your profile</h3>{account.profile.avatar_url && <img className="account-avatar" src={account.profile.avatar_url} alt="" referrerPolicy="no-referrer" />}<label>Display name<input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label><Button onClick={save}><Save />Save profile</Button><p role="status">{message}</p></div>}</div>;
}