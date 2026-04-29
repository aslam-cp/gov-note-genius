# Government of Kerala — File Noting Assistant

An officer-facing AI assistant that reads Government of Kerala case file documents (PDF / image, often containing Malayalam) and drafts official Sachivalayam-style file notings from the perspective of the Director / CEO. Notings are grounded in a configurable knowledge base (Kerala Financial Code, Stores Purchase Manual, KPWD Manual, Finance Department GOs, circulars).

## Stack

- **Frontend / SSR**: TanStack Start + React 19, Vite 7, Tailwind 4, Radix UI, TanStack Router (file-based), TanStack Query.
- **Server runtime**: Cloudflare Workers (via `@cloudflare/vite-plugin` + Wrangler).
- **Backend services**: Supabase — Postgres (case data, knowledge bases), Auth (JWT), Storage (`rule-library` bucket).
- **LLM**: Google Gemini (`gemini-2.5-flash`) via the OpenAI-compatible gateway.
- **Tooling**: Bun (preferred), ESLint, Prettier, TypeScript.

## Prerequisites

- [Bun](https://bun.sh) (or Node 20+ with npm).
- A Supabase project (URL, anon/publishable key, service role key).
- A Google Gemini API key.
- Optional: Wrangler CLI for Cloudflare deployment.

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required keys:

| Variable | When | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build | Inlined into the browser bundle. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build | Inlined into the browser bundle. |
| `SUPABASE_URL` | runtime | Used by the server (auth middleware, AI server fns). |
| `SUPABASE_PUBLISHABLE_KEY` | runtime | Used by `auth-middleware` to verify JWTs. |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **Server-only.** Reads rule docs, signs storage URLs. Never expose to the browser. |
| `GEMINI_API_KEY` | runtime | Bearer for the Gemini OpenAI-compatible gateway. |

For Wrangler-based local dev against Cloudflare, the runtime keys go in `.dev.vars` instead. For Docker, the same `.env` is read by `docker-compose.yml`.

## Quick start

```bash
cp .env.example .env       # fill in real values
bun install
bun dev                    # http://localhost:8080
```

Run with Docker instead:

```bash
docker compose up --build  # http://localhost:3000
```

Other scripts:

```bash
bun run build        # production build (Cloudflare Workers)
bun run build:dev    # build with development mode flag
bun run preview      # preview the built app
bun run lint         # eslint
bun run format       # prettier --write
```

## Database

Supabase migrations live in `supabase/migrations/`. The schema includes:

- `knowledge_bases` — named groupings of rule documents.
- `rule_documents` — uploaded reference docs (KFC, GOs, manuals, etc.) with metadata (`category`, `reference_no`, `year`, `summary`).
- `rule_document_kbs` — many-to-many between docs and knowledge bases.

Apply migrations with the Supabase CLI:

```bash
supabase db push
```

A storage bucket named `rule-library` must exist for rule documents.

## Project structure

```
src/
  routes/                       file-based TanStack routes
    __root.tsx                  AuthProvider + AppLayout shell
    index.tsx, new.tsx, history.tsx, rule-library.tsx
    case.$caseId.upload.tsx
    case.$caseId.analysis.tsx
    case.$caseId.noting.tsx
  components/                   screens + shadcn-style ui/
  integrations/supabase/        client (browser), client.server, auth-middleware, generated types
  lib/
    ai.functions.ts             analyzeCase + generateNoting server fns
    auth-context.tsx            useAuth() — onAuthStateChange-first ordering
    noting-types.ts             NotingType, CaseAnalysis types
    session.ts                  per-device officer session id (localStorage)
  router.tsx                    TanStack Router setup + error boundary
  routeTree.gen.ts              GENERATED — do not edit
supabase/
  migrations/                   SQL schema
  config.toml
wrangler.jsonc                  Cloudflare Workers config
vite.config.ts                  uses @lovable.dev/vite-tanstack-config preset
```

## How the AI pipeline works

Two TanStack Start server functions in `src/lib/ai.functions.ts`:

1. **`analyzeCase`** — sends uploaded case docs (and optional `[RULE]` docs from selected knowledge bases) to Gemini, which is forced to return a structured `CaseAnalysis` (subject, brief, facts, issues, deficiencies, rules, recommendation, verdict) via an OpenAI-style tool call.
2. **`generateNoting`** — takes the analysis + docs + a `notingType` (`approve`, `reject`, `putup_positive`, `putup_negative`, `other`) and an optional `refinement` (`shorter`, `longer`, `more_formal`, `stronger_rules`, `regenerate`), and returns plain prose between 100 and 150 words.

Knowledge-base documents are fetched server-side from the Supabase `rule-library` bucket via signed URLs, downloaded, and inlined into the request as base64 data URLs (cap: 15 MB per file, top 5 docs).

### Prompting invariants

- The model writes **as the Director / CEO issuing a final order**, not as a subordinate recommending up.
- No markdown, bullet glyphs, or paragraph numbering. The handler also strips `* _ \` ~ # | >` and leading numbering as a safety net.
- When no knowledge base is selected, the model is forbidden from citing specific KFC articles, GO numbers, Stores Purchase Manual paragraphs, or KPWD Manual paragraphs unless they appear verbatim in the case documents. This is deliberate — hallucinated citations are worse than no citation.

## Deployment

For full production deployment instructions — Cloudflare Workers, Docker, and Kubernetes / Jio Cloud — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Quick start (Cloudflare Workers, the default target):

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY
wrangler deploy
```

## Vite config — important

`vite.config.ts` is intentionally minimal. The `@lovable.dev/vite-tanstack-config` preset already includes `tanstackStart`, `viteReact`, `tailwindcss`, `vite-tsconfig-paths`, the Cloudflare plugin (build only), `componentTagger` (dev only), `VITE_*` env injection, the `@` path alias, and React/TanStack dedupe. **Do not re-add any of these** — duplicates break the app.

## License

Internal — Government of Kerala / KSITM.
