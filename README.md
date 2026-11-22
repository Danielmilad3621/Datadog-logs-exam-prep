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

Question-bank migration: supabase/migrations/20261122000100_question_bank.sql.
The existing profiles, study_progress, and progress-sync functions are preserved.
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

## Managing questions

Sign in with the existing allowed Google account, then choose **Manage questions**.

- **Questions:** add a draft or edit a question, choose its category/set/difficulty, provide its answer and optional explanation/source, then publish it.
- **Import a set:** download the CSV template, create a question set, choose defaults, upload/paste CSV or JSON, validate and review every row, then save drafts. Imports never overwrite existing question IDs.
- **Categories & sets:** add categories or sets, apply a difficulty to all questions in a set, and publish reviewed drafts together.
- **Export bank:** download the current library as JSON. Supabase is the live source of truth; src/data/questions.json is only the original seed.
- **Study:** filter flashcards/topic practice by category, set or difficulty. “Hard for me” is a separate personal flag synced with progress. Full mocks keep the existing 90-question format.
- Archive a published question to keep its history while excluding it from new practice. Published questions cannot be reverted to drafts.
- In-progress quizzes retain their question/answer snapshots, so later edits do not change their scoring.

### Import format

CSV headers: prompt,type,optionA,optionB,optionC,answers,categoryCode,difficulty,explanation,source,sourcePage.
Use A|B for multiple correct answers. Quote CSV cells containing commas or newlines.
JSON accepts an array or an exported bank with a questions array. Categories may use categoryCode or the original topicCode.
Question type is single, multi, or truefalse. Difficulty is unrated, easy, medium, or hard.
Defaults fill missing category/difficulty values; the selected set applies to the whole import.
All imports start as drafts. Files are limited to 10 MB / 500 questions per import.
Repeated question text is rejected; the two original repeated prompts are preserved for existing progress.

### Initial database setup

Run npx supabase db push --remote=frkxihaebhzwozoxxocn --dry-run, review the plan, then apply with --yes.
The recovered 20261107221505 baseline matches existing migration history and is not reapplied.
The new migration is supabase/migrations/20261122000100_question_bank.sql.
It creates only the question-bank tables/functions, seeds the original 210 IDs, and reuses the existing private.can_study() authorization predicate.
It does not reset or rewrite study progress. Keep a database backup before future migrations.
Do not run this initial migration a second time on the same database.

### Code changes and Vercel

The GitHub main branch is connected to the Vercel project log-lab-exam-compass.
Push code changes through a branch/PR. Vercel builds the app and runs unit tests and TypeScript checks before making a deployment ready.
Question content changes are saved directly to Supabase and appear when the study page reloads; they do not require a Git commit or deployment.

Validation:
- npm ci
- npm run check
- npm run build
- python3 scripts/test-question-migration.py (requires the disposable log-lab-bank-test PostgreSQL Docker container)

Use the same project URL/key on the server and frontend. Never commit .env files, access tokens, or user progress exports.
