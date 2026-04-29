# Government of Kerala — File Noting Assistant

AI-assisted file noting for government officers. Built on TanStack Start (SSR), deployed to Cloudflare Workers, backed by Supabase, and powered by Gemini 2.5 Flash.

## Build & Dev Commands

```bash
bun install          # install dependencies (Bun only — not npm/yarn)
bun run dev          # start dev server
bun run build        # production build (Cloudflare Workers target)
bun run lint         # ESLint 9
bun run format       # Prettier
```

Deploy via `wrangler deploy` after `bun run build`.

## Architecture

| Layer | Details |
|---|---|
| Routing | TanStack Router — file-based routes in `src/routes/` |
| SSR | TanStack Start with `createServerFn` for server-side logic |
| Deploy target | Cloudflare Workers (`wrangler.jsonc`, `nodejs_compat` flag) |
| Database | Supabase Postgres + RLS + Storage (`supabase/`) |
| Auth | `useAuth()` from `src/lib/auth-context.tsx` |
| AI | Gemini 2.5 Flash via OpenAI-compat gateway in `src/lib/ai.functions.ts` |
| UI | shadcn/ui pattern — Radix UI + Tailwind CSS v4, components in `src/components/ui/` |
| Path alias | `@/` → `src/` |

**Key files:**
- `src/lib/ai.functions.ts` — all AI/server functions (Gemini calls, KB fetching)
- `src/lib/noting-types.ts` — `NotingType`, `CaseAnalysis`, `NOTING_OPTIONS`
- `src/integrations/supabase/types.ts` — generated DB types (never edit)
- `src/integrations/supabase/client.ts` — lazy browser client
- `src/integrations/supabase/client.server.ts` — admin client (server-only)

## Conventions

### Routing
- Add routes by creating files in `src/routes/` — dynamic segment: `case.$caseId.tsx`
- **Never manually edit `src/routeTree.gen.ts`** — auto-generated on `bun run dev`

### Server Functions
- All server-side logic (DB writes, AI calls, signed URLs) must use `createServerFn` from `@tanstack/react-start`
- Server functions run on Cloudflare Workers — avoid Node-only APIs not covered by `nodejs_compat`
- Use `src/integrations/supabase/client.server.ts` (admin client) only inside server functions

### Supabase
- Client-side: import from `src/integrations/supabase/client.ts`
- Server-side: use `getAdminClient()` from `src/lib/ai.functions.ts` or `client.server.ts`
- Env vars — client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Schema changes go in `supabase/migrations/` — apply with `supabase db push`

### UI Components
- Use existing `src/components/ui/` primitives (shadcn/ui); avoid adding new UI libraries
- New shadcn components: `bunx --bun shadcn@latest add <component>`
- Toast notifications via `sonner` (`src/components/ui/sonner.tsx`)
- One file per screen component in `src/components/`

### TypeScript
- Strict mode enabled; no `any` without a comment
- Use `@/` alias for all non-relative imports within `src/`
