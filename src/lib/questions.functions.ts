import { createServerFn } from "@tanstack/react-start";
import type { Question } from "@/lib/question-types";
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isStudyAccount } from './study-access';

// The question bank is returned only after validating the personal Google account.
export const getQuestions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.auth.getUser();
  if (error || !isStudyAccount(data.user)) throw new Error('This study space is restricted to your Google account.');
  const bank = (await import("@/data/questions.json")).default;
  return bank as Question[];
});
