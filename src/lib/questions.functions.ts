import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { readQuestionBank } from './question-bank.functions';

// The database is the live source; JSON is retained only as the original seed/export.
export const getQuestions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await readQuestionBank(context.supabase, false)).questions);
