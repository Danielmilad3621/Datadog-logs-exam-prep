import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let instance: ReturnType<typeof createClient<Database>> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    if (!instance) {
      const url = import.meta.env['VITE_SUPABASE_URL'];
      const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) throw new Error('Supabase connection settings are missing.');
      instance = createClient<Database>(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    return Reflect.get(instance, prop);
  },
});
