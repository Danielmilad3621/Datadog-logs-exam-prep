import { createFileRoute, useRouter } from '@tanstack/react-router';
import StudyApp from '@/components/study-app';
import { getQuestions } from '@/lib/questions.functions';
import { getStudyAccount } from '@/lib/study-account.functions';
import { useCloudProgress } from '@/hooks/use-cloud-progress';
import { Button } from '@/components/ui/button';
import { AccountControls } from '@/components/account-controls';
import { retryStudyRead } from '@/lib/retry-study-read';

export const Route = createFileRoute('/_authenticated/study')({
  loader: async () => ({ account: await retryStudyRead(() => getStudyAccount()), questions: await retryStudyRead(() => getQuestions()) }),
  errorComponent: StudyLoadError,
  head: () => ({ meta: [
    { title: 'Your Study Space | Log Lab' }, { name: 'description', content: 'Your private Datadog practice, flashcards and synced Mistakes deck.' },
    { property: 'og:title', content: 'Your Study Space | Log Lab' }, { property: 'og:description', content: 'Your private Datadog study space.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  component: Study,
});
function StudyLoadError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <main className="account-page"><div className="account-content"><h1>Study space couldn’t load</h1><p>The connection was interrupted or your account could not be verified. Your saved progress is safe.</p><Button onClick={() => { void router.invalidate(); reset(); }}>Try again</Button></div></main>;
}
function Study() {
  const { account, questions } = Route.useLoaderData();
  const sync = useCloudProgress(account.userId);
  if (sync.conflict) return <main className="account-page"><div className="account-content"><h1>Progress changed on another device</h1><p>Your saved progress and this device’s progress are different. Both are safe until you choose.</p><div className="flex flex-wrap gap-3"><Button onClick={() => sync.resolve(true)}>Use cloud progress</Button><Button variant="outline" onClick={() => sync.resolve(false)}>Keep this device’s progress</Button></div></div></main>;
  if (!sync.ready) return <main className="account-page"><div className="account-content"><h1>Log Lab</h1><p role="status">{sync.status}</p></div></main>;
  return <StudyApp questions={questions} progress={sync.progress} setProgress={sync.setProgress} accountControls={<AccountControls account={account} status={sync.status} />} />;
}