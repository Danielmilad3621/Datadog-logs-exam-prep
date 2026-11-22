# Log Lab Exam Compass

Independent Datadog study app using TanStack Start, Vercel, and Supabase.
Includes 210 questions, flashcards, topic practice, timed mocks, mistakes review, and synced progress.
This is a third-party study aid, not an official Datadog product.

## Development
Install Node.js 24 LTS, then:
```powershell
npm.cmd ci
npm.cmd run dev
```
Open http://127.0.0.1:5184. Copy .env.example to .env and fill in the Supabase public connection settings.
Google sign-in is restricted to the confirmed account danielmilad3621@gmail.com.
Allow http://127.0.0.1:5184/auth in Supabase Authentication URL Configuration for local login.

## Validation
```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

## Hosting and database
Vercel builds the frontend and private server functions using Nitro's Vercel preset.
Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, and SUPABASE_PUBLISHABLE_KEY in Vercel.
Only public/publishable keys are used. No service-role key is needed by the application.

Schema: database/001_study_progress.sql.
Public tables: profiles and study_progress, protected by row-level security and verified Google identity.
Save operations check the revision number; conflicts require an explicit choice.
Private migration data is attached to the allowed account on its first sign-in.
The question bank stays in src/data and is served only after server-side account validation.

Progress is synced across devices; an in-progress quiz is recovered only in its current browser.
Progress > Export progress and Import progress provide manual backups.

## Branding
The app uses its own Log Lab SVG icon, with no external builder SDK, telemetry, images or badges.

## Extracting questions
```powershell
python -m pip install pymupdf
python scripts/extract_questions.py 'C:/path/to/source.pdf'
```
The extractor expects 210 numbered questions and writes to src/data.
Question 149 preserves the source answer-key inconsistency warning.
