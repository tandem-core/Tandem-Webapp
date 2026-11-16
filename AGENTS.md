<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (Tandem)

- Stack: Next.js App Router, TypeScript, Tailwind CSS v4. Tailwind is set up in `app/globals.css`; there is no `tailwind.config` file.
- Routes go in `app/`, shared components in `components/`, static files in `public/`. Use the `@/` import alias.
- The repo is public: never write secrets into code. Read them from `process.env` and add them in the Vercel project's settings.
- Run `npm run build` and `npm run lint` before pushing. `main` deploys to production on Vercel; pull requests get preview links.
