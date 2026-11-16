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
