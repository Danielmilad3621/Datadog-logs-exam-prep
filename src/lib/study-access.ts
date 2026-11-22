export function isStudyAccount(user: { email?: string; email_confirmed_at?: string; identities?: { provider: string }[] } | null) {
  return Boolean(user?.email?.toLowerCase() === 'danielmilad3621@gmail.com' && user.email_confirmed_at && user.identities?.some(i => i.provider === 'google'));
}