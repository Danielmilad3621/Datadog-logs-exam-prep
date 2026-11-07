# Datadog Log Lab — private study application

A Windows-friendly Next.js study app built from the **user-provided 52-page PDF** (210 numbered questions). This is a third-party question bank, **not** an official Datadog product or exam.

## Contents

- **210 flashcards**, with source question, original choices, the PDF's answer key, and page number.
- **Topic practice:** select official guide domain + subtopic and practice 10/20/30/50 questions. Supports single-answer, multiple-answer and true/false content from the PDF.
- **Full mock:** 90 single-answer multiple-choice questions, 120-minute countdown, question navigation, flags, no immediate feedback.
- **Simulated scoring:** select 75 of the 90 questions at random to count, with 15 designated as simulated pretest. These are NOT real Datadog pretest items, and the score is NOT a pass prediction.
- **Local progress:** browser storage, flashcard ratings, past practice/mocks; export/import progress for manual cross-device transfer.
- **Basic Auth gate:** hosted site requires one shared password (`STUDY_PASSWORD`), username `student`. There is no automatic multi-device sync.

## Extracted question counts

- 210 total
- 118 single-answer multiple-choice (eligible for mock)
- 51 multiple-answer
- 41 true/false
- One answer-key inconsistency: **Question 149** says choose two, but lists three correct answers. This item is flagged rather than silently corrected.

The questions are tagged to the domains/subtopics quoted from the Datadog prep guide, as a *study classification*. Official exam weightings and pass mark are not known from this bank. Some parts of the bank might be obsolete or incorrect; verify against https://docs.datadoghq.com/logs/.

## Windows setup with PowerShell

1. Install **Node.js 20.9+** (latest LTS recommended): https://nodejs.org/en/download
2. Unzip the project on your Desktop. Rename the extracted folder to `datadog-log-lab` if necessary.
3. Open PowerShell and run:

```powershell
cd "$env:USERPROFILE\Desktop\datadog-log-lab"
node --version
npm --version
npm install
npm run dev
```

4. Open http://localhost:3000. On your laptop, development does not require a password when `STUDY_PASSWORD` is unset.
5. Stop the development server with `Ctrl+C`.

## Deploy to YOUR Vercel account (no GitHub required)

1. From PowerShell in the project folder:

```powershell
npm install -g vercel
vercel login
vercel
```

2. Follow the prompts to choose your Vercel account, create/link a project and select the project root. This produces a preview deployment.
3. Open **Vercel Dashboard → Project → Settings → Environment Variables**. Set:

   | Name | Value | Environment |
   | --- | --- | --- |
   | `STUDY_PASSWORD` | a long, unique password you choose | Preview + Production |

4. Redeploy after changing environment variables:

```powershell
vercel --prod
```

5. Open your generated `.vercel.app` URL. Your browser should ask for username/password. Username is `student`; password is your `STUDY_PASSWORD`.
6. If you see status 503, the password is missing from the deployed environment or the deployment wasn't rebuilt after setting it. If you see status 401, the username/password does not match.

**Do not put your password in the code, commit it to GitHub, or prefix it with `NEXT_PUBLIC_`.** This is a lightweight single-user Basic Auth gate. For multi-user access, use a proper account system (e.g. Auth.js) and a database.

## Alternative GitHub-based continuous deployment

1. Create a **private** GitHub repository named `datadog-log-lab`.
2. Install Git for Windows, then in the project root:

```powershell
git init
git add .
git commit -m "Initial private study app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/datadog-log-lab.git
git push -u origin main
```

3. In Vercel, choose **Add New → Project**, import your private repository. It should detect Next.js.
4. Add `STUDY_PASSWORD` to the Vercel project environment variables. Deploy. Every future push to `main` redeploys automatically.

## Privacy and limitations

- The imported question bank is stored in **`server/questions.json`** (not under `public/`) and delivered only via a password-gated rendered page. The app must be deployed with `STUDY_PASSWORD` in production.
- A **private GitHub repository alone does NOT make a Vercel website private**. The included access gate is important.
- The app stores results locally in the browser. Different devices will have different progress until you export/import manually.
- Vercel does not retain browser `localStorage`, so this MVP does not need a database. If you clear site data, you can lose progress. Export backups periodically.
- The app doesn't use your VPS. Later, Supabase (or a small Postgres database on your existing VPS) can provide private automatic sync and accounts.
- Respect the rights of the publisher whose PDF you uploaded. Keep the app for your personal study; do not redistribute the questions publicly.

## Adjusting questions and source content

- Edit `server/questions.json` to fix typos, correct an answer key **after independent verification**, or revise its `domain` / `topic` field.
- See `server/extraction-report.json` for validation issues.
- To re-extract from another copy of the supplied PDF, install PyMuPDF with Python and run:

```powershell
python -m pip install pymupdf
python scripts/extract_questions.py "C:\path\to\source.pdf"
```

Use the same PDF structure; the script intentionally expects exactly 210 numbered questions.

## Official references

- Next.js for Windows: https://nextjs.org/docs/app/getting-started/installation
- Next.js Proxy authentication gate: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Vercel deployment: https://vercel.com/docs/deployments
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Datadog certification and exam info: https://www.datadoghq.com/certification/overview/
- Datadog logging documentation: https://docs.datadoghq.com/logs/
