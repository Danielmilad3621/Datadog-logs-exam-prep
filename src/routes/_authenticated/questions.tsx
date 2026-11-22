import { createFileRoute, Link } from '@tanstack/react-router';
import { getQuestionBank } from '@/lib/question-bank.functions';
import { QuestionManager } from '@/components/question-manager';

export const Route = createFileRoute('/_authenticated/questions')({
  loader: () => getQuestionBank(),
  head: () => ({ meta: [{ title: 'Manage questions | Log Lab' }, { name: 'robots', content: 'noindex' }] }),
  errorComponent: ({ error, reset }) => <main className="content manager"><h1>Question management couldn’t load</h1><p role="alert">{error instanceof Error ? error.message : 'Please retry.'}</p><button className="btn btn-primary" onClick={reset}>Try again</button> <Link to="/study">Back to study</Link></main>,
  component: () => <QuestionManager initial={Route.useLoaderData()} />,
});
