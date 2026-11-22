import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isStudyAccount } from './study-access';

export const getStudyAccount = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !isStudyAccount(data.user)) throw new Error('This study space is restricted to your Google account.');
  const { data: profile, error: profileError } = await context.supabase.from('profiles').select('display_name, avatar_url').eq('id', context.userId).single();
  if (profileError) throw new Error('Could not load your profile.');
  return { userId: context.userId, profile };
});