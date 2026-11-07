import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Log Lab | Datadog Study Companion',
  description: 'Private Datadog Log Management Fundamentals question bank, flashcards, and timed exam practice.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
