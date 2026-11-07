import StudyApp from './study-app';
import questionBank from '../server/questions.json';
import type { Question } from './types';

// Keep the question bank on the server; do not import it from a client component.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <StudyApp questions={questionBank as Question[]} />;
}
