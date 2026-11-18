# Tandem web app

The Tandem web app, built with [Next.js](https://nextjs.org) (App Router), TypeScript and [Tailwind CSS](https://tailwindcss.com), and deployed on [Vercel](https://vercel.com).

## How deploys work

- Every push to `main` goes live on the production URL.
- Every pull request gets its own preview link, which Vercel posts on the pull request. Check it before merging.
- This repo is **public**. Never commit API keys or passwords. Put them in Vercel (Project Settings > Environment Variables) and, for local work, in `.env.local`, which git ignores.

## Run it locally

You need Node.js 20.9 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # run before pushing; Vercel runs the same build
npm run lint
```

## Adding screens from Figma

- Generate React + Tailwind code into this project instead of starting a new one.
- Pages go in `app/` (one folder per route, each with a `page.tsx`), shared components in `components/`, images and icons in `public/`.
- Work on a branch and open a pull request. Merge once the preview link looks right.
- Coding agents: read `AGENTS.md` first (Claude Code loads it through `CLAUDE.md`). This Next.js version differs from older ones, and its docs ship in `node_modules/next/dist/docs/`.

## Audio processing prototype (local)

Go to **Visits → Process a recording** (`/demo/process`). This workspace now includes a Python processing service and a SQLite database. New results are saved separately from the prepared demo and shown in the processing review page; they are not automatically promoted into the main Prescriptions or Action items tabs.

Requirements: Python 3.9+ and `ffmpeg` on PATH. No Python packages need installing.

Start these in two terminals:

```bash
npm run pipeline:serve
npm run dev
```

Choose a provided recording or upload an audio file smaller than 24 MB. Fresh mode converts audio to MP3, transcribes it with timestamped segments, extracts structured medication mentions and action items, validates evidence references, and cuts actual audio clips for those references. Processing runs in a background worker and the page polls its status.

For **fresh AI processing**, add this to your ignored `.env.local`, then restart the Python service:

```dotenv
OPENAI_API_KEY=your_private_api_key
EXTRACTION_MODEL=gpt-4.1-mini
```

The transcription model is `whisper-1` for segment timestamps. Live runs send recording/transcript data to OpenAI and use API credits. Keep the key server-side. Documentation: [timestamped transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

For **replay mode**, no key is needed: it loads the prepared transcripts and extractions for the selected audio, then exercises validation, database persistence, and clip generation. The UI labels replay explicitly. Replay does **not** measure fresh transcription or extraction accuracy.

```bash
npm run pipeline:test    # offline validation/database regression tests
npm run pipeline:replay  # all five supplied recordings, using prepared fixtures
npm run pipeline:live    # all five recordings through the actual AI services
```

Local data lives in ignored `.tandem-data/`: `tandem.sqlite`, original uploads, and generated clips. Tables are `jobs` (status, model, prompt version, audio hash, result), `transcript_segments`, `medications`, and `action_items`. Medication/dose evidence references identify persisted transcript segments. Model results are drafts; evidence validation checks structure and references, not medical truth. Patient/clinician identity and dates are not inferred from recording content. The prepared recordings contain different demo patients and must not be combined into a real patient record.

The service binds to `127.0.0.1:8765`. The Next.js bridge is intentionally disabled in production: this is a local, single-user prototype. A hosted version needs a separately deployed Python worker, private object storage, authenticated patient ownership, durable job processing, and a shared production database before enabling uploads. SQLite is used here to let you test immediately without provisioning a database.
