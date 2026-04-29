# Production Deployment Guide

This document describes how to deploy the Government of Kerala File Noting Assistant to production. The repository is wired by default for Cloudflare Workers; this guide also covers a containerised Node deployment suitable for self-hosted infrastructure such as **Jio Cloud Services (JCS)**, generic Kubernetes clusters, or any Linux VM with Docker.

---

## 1. Deployment targets at a glance

| Target | Runtime | Notes |
| --- | --- | --- |
| Cloudflare Workers | Workers (V8 isolates) | Default. No body-size headaches. Configured via `wrangler.jsonc`. |
| Docker (single VM) | Node 22 | Smallest footprint. Good for staging and small-scale prod. |
| Kubernetes / JCS JKE | Node 22 in container | Recommended for HA prod. |
| Vercel / generic Node host | Node 22 | Mind the request-body cap on the platform — uploads can reach 15 MB. |

The AI pipeline inlines case documents up to ~15 MB each as base64 in the request to Gemini. Any host with a small request-body cap (Vercel Hobby = 4.5 MB) will fail uploads. Workers, Node behind nginx (with `client_max_body_size` raised), and Kubernetes ingresses are all fine.

---

## 2. Required secrets

These must be present at runtime on the server:

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | server |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key, used by `auth-middleware` for token verification | server |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged key used by `ai.functions.ts` to read rule docs and sign storage URLs | **server only — never ship to browser** |
| `GEMINI_API_KEY` | Bearer for the Gemini OpenAI-compatible gateway | server |

These are required at **build time** (Vite inlines them into the client bundle):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL`, but baked into the browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY`, baked into the browser bundle |

In Docker, build-time vars must be passed via `--build-arg` (see compose file). Setting them only at `docker run` time will not affect the already-baked frontend.

---

## 3. Pre-deployment checklist

- [ ] Supabase migrations applied: `supabase db push` against the production project.
- [ ] Supabase storage bucket `rule-library` exists and contains the rule documents.
- [ ] Supabase Auth providers configured (email + any OAuth providers in use).
- [ ] All four runtime secrets set in the target environment.
- [ ] `bun run lint` passes locally.
- [ ] `bun run build` succeeds against the chosen target.
- [ ] Outbound network from the server can reach `*.supabase.co` and `generativelanguage.googleapis.com`.

---

## 4. Option A — Cloudflare Workers (default)

This is what `wrangler.jsonc` and the Lovable Vite preset already build for.

```bash
bun install
bun run build

wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY

wrangler deploy
```

Notes:

- `wrangler.jsonc` sets `compatibility_flags: ["nodejs_compat"]`, which is required by `@supabase/supabase-js`.
- The `componentTagger` Vite plugin is dev-only and is stripped from the build.
- Workers logs: `wrangler tail`.

---

## 5. Option B — Docker on a single VM

Best for: small deployments, staging, JCS compute (VM + Docker).

### 5.1 Switch the build target to Node

The default Vite config uses `@lovable.dev/vite-tanstack-config`, which hardcodes the Cloudflare plugin on `build`. For a Node container, replace `vite.config.ts` with:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({ target: "node-server" }),
    viteReact(),
  ],
});
```

After `bun run build`, the output is `.output/server/index.mjs` plus `.output/public/`. The provided `Dockerfile` runs it directly.

### 5.2 Build & run

Create a `.env` next to `docker-compose.yml`:

```ini
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

Then:

```bash
docker compose up -d --build
```

The app listens on `http://<host>:3000`. Put nginx (or another reverse proxy) in front for TLS and to set `client_max_body_size 20m;`.

### 5.3 Updating

```bash
git pull
docker compose up -d --build
docker image prune -f
```

---

## 6. Option C — Kubernetes (JCS JKE or generic)

Best for: production with HA, autoscaling, managed TLS.

### 6.1 Build & push the image

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  -t <registry>/gov-note-genius:<git-sha> .

docker push <registry>/gov-note-genius:<git-sha>
```

For JCS, `<registry>` is the JCS Container Registry hostname assigned to your project.

### 6.2 Cluster resources

Create a `Secret` for the four runtime variables and a `Deployment` + `Service` + `Ingress`. Minimum shape:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gov-note-genius-secrets
type: Opaque
stringData:
  SUPABASE_URL: ...
  SUPABASE_PUBLISHABLE_KEY: ...
  SUPABASE_SERVICE_ROLE_KEY: ...
  GEMINI_API_KEY: ...
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gov-note-genius
spec:
  replicas: 2
  selector:
    matchLabels: { app: gov-note-genius }
  template:
    metadata:
      labels: { app: gov-note-genius }
    spec:
      containers:
        - name: app
          image: <registry>/gov-note-genius:<git-sha>
          ports: [{ containerPort: 3000 }]
          envFrom:
            - secretRef: { name: gov-note-genius-secrets }
          env:
            - { name: NODE_ENV, value: production }
            - { name: PORT, value: "3000" }
          readinessProbe:
            httpGet: { path: /, port: 3000 }
            initialDelaySeconds: 10
          livenessProbe:
            httpGet: { path: /, port: 3000 }
            initialDelaySeconds: 30
          resources:
            requests: { cpu: 200m, memory: 256Mi }
            limits:   { cpu: 1000m, memory: 1Gi }
---
apiVersion: v1
kind: Service
metadata:
  name: gov-note-genius
spec:
  selector: { app: gov-note-genius }
  ports:
    - port: 80
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gov-note-genius
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "20m"
spec:
  rules:
    - host: notings.example.gov.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gov-note-genius
                port: { number: 80 }
```

### 6.3 Network policy

If the cluster default-denies egress (common on JKE), allow:

- TCP 443 to `*.supabase.co`
- TCP 443 to `generativelanguage.googleapis.com`

---

## 7. Operations

### Logs

- Cloudflare: `wrangler tail`.
- Docker: `docker compose logs -f app`.
- Kubernetes: `kubectl logs -f deploy/gov-note-genius`, or whatever logging stack JKE provides.

### Health

The app serves `/` even when unauthenticated (the auth screen). A 200 from `/` is a sufficient liveness signal.

### Rollback

- Cloudflare: `wrangler rollback`.
- Docker: re-deploy the previous image tag.
- Kubernetes: `kubectl rollout undo deploy/gov-note-genius`.

### Rotating secrets

Supabase service-role key or Gemini API key:

1. Issue the new key.
2. Update the secret in the target platform.
3. Redeploy / restart pods so the process picks up the new env.
4. Revoke the old key.

---

## 8. Common pitfalls

- **`SUPABASE_SERVICE_ROLE_KEY` leaking into the client bundle.** Never prefix it with `VITE_`. Search the build output for it before deploying: `grep -R service_role .output/public` should return nothing.
- **`VITE_*` vars set only at runtime.** They are inlined at build time. If the browser bundle has the wrong Supabase URL, you forgot to pass the build-arg.
- **Body-size limits.** Vercel Hobby and stripped-down ingresses cap requests at a few MB. Uploads of 10–15 MB PDFs will silently fail. Raise `client_max_body_size` / `proxy-body-size` to at least 20 MB.
- **Re-adding plugins to `vite.config.ts`.** The Lovable preset already includes `tanstackStart`, `viteReact`, `tailwindcss`, `tsconfigPaths`, the Cloudflare plugin, and `componentTagger`. Duplicating any of these breaks the build. If you switch off the preset (Option B/C), you own the full plugin list yourself.
- **Cloudflare without `nodejs_compat`.** `@supabase/supabase-js` will fail at runtime. Keep the flag in `wrangler.jsonc`.
