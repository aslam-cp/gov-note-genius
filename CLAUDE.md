# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Government of Kerala officer-facing AI assistant that ingests case file documents (PDF/image, often containing Malayalam) and drafts official Sachivalayam-style file notings from the perspective of the Director / CEO. Built on TanStack Start (file-based routing) deployed to Cloudflare Workers, with Supabase for auth/storage/data and Google Gemini as the LLM.

## Commands

- `bun dev` (or `npm run dev`) — Vite dev server.
- `bun run build` — production build (Cloudflare Workers via `@cloudflare/vite-plugin`).
- `bun run lint` — ESLint over the repo.
- `bun run format` — Prettier write.

There is no test runner configured.

## Vite config — important

`vite.config.ts` is intentionally minimal. The preset `@lovable.dev/vite-tanstack-config` already wires up `tanstackStart`, `viteReact`, `tailwindcss`, `vite-tsconfig-paths`, the Cloudflare plugin (build only), `componentTagger` (dev only), `VITE_*` env injection, the `@` path alias, and React/TanStack dedupe. **Do not re-add any of these** — duplicates break the app. Pass extra config through `defineConfig({ vite: { ... } })`.

## Architecture

### Routing

File-based via TanStack Router. `src/routes/` is the source of truth; `src/routeTree.gen.ts` is generated — never edit it. `__root.tsx` mounts `<AuthProvider>` → `<AppLayout>` → `<Outlet>` and the sonner Toaster. Case-scoped routes use the param pattern `case.$caseId.{upload,analysis,noting}.tsx`.

### Auth & Supabase

- Two clients: `src/integrations/supabase/client.ts` (browser, anon key) and `client.server.ts` (server). `types.ts` is generated from the DB schema.
- `auth-middleware.ts` (`requireSupabaseAuth`) is a TanStack Start server middleware that validates the `Authorization: Bearer <token>` header via `supabase.auth.getClaims` and injects `{ supabase, userId, claims }` into server-fn context. Header is generated; do not hand-edit.
- Browser auth state lives in `src/lib/auth-context.tsx` (`useAuth()`), which subscribes to `onAuthStateChange` **before** calling `getSession` — preserve that order to avoid missed events.
- `src/lib/session.ts` is a separate localStorage-only "officer session id" used as a per-device correlation id; it is **not** an auth mechanism.

### AI pipeline (`src/lib/ai.functions.ts`)

Two `createServerFn` POST endpoints drive the product:

1. `analyzeCase` — sends case docs (and optionally [RULE] docs from selected knowledge bases) to Gemini and forces a structured response via the `submit_analysis` OpenAI-style tool call. Returns a `CaseAnalysis` (see `src/lib/noting-types.ts`).
2. `generateNoting` — takes the analysis + docs + a `notingType` (`approve | reject | putup_positive | putup_negative | other`) plus optional `refinement` (`shorter | longer | more_formal | stronger_rules | regenerate`) and `previousNote`, and returns plain-prose noting text.

Both call Gemini through the OpenAI-compatible gateway at `generativelanguage.googleapis.com/v1beta/openai/chat/completions` using the model constant `MODEL = "gemini-2.5-flash"` (single source of truth at the top of the file). Knowledge-base docs are fetched from Supabase storage `rule-library` via signed URLs, downloaded server-side, and inlined as base64 data URLs (cap 15 MB per file, top 5 docs). PDFs/images go in as `image_url` parts.

**Prompting invariants — change with care:**

- The `SYSTEM_NOTING` system prompt forbids markdown, bullet glyphs, and paragraph numbering. The handler additionally strips `* _ \` ~ # | >`, bullet glyphs, and leading paragraph numbering as a safety net. Keep system prompt and stripper in sync.
- Length target for notings: 100–150 words.
- When `kbIds` is empty the prompts explicitly forbid citing specific KFC articles, GO numbers, Stores Purchase Manual / KPWD paragraphs. The "no fabrication" rules in both `analyzeCase` and `generateNoting` are load-bearing — they exist because hallucinated rule citations are worse than no citation in this domain.
- The model writes **as the Director / CEO issuing a final order**, not as a subordinate recommending up. `approve` / `reject` are operative orders; `putup_*` submits to higher authority.

### Database

Supabase project id `shfkjcgayqmtjubhjawp`. Migrations in `supabase/migrations/` define tables `knowledge_bases`, `rule_documents`, `rule_document_kbs` (join), backing the rule library. Storage bucket: `rule-library`.

### Env vars (server)

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — used by `auth-middleware` for token verification.
- `SUPABASE_SERVICE_ROLE_KEY` — used by `ai.functions.ts` admin client to read rule docs and sign storage URLs. Never expose client-side.
- `GEMINI_API_KEY` — Gemini gateway bearer.
- Browser uses `VITE_*` vars (auto-injected by the Lovable preset).

## Path alias

`@/...` maps to `src/...` (configured through `vite-tsconfig-paths`).
