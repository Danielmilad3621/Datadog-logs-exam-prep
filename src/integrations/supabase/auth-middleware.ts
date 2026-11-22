import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isStudyAccount } from '@/lib/study-access';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const header = getRequest().headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const url = process.env['SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !isStudyAccount(data.user)) throw new Error('This study space is restricted to your Google account.');
  return next({ context: { supabase, userId: data.user!.id } });
});
