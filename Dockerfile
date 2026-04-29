# ---------- Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy only package files first (cache-friendly)
COPY package.json package-lock.json ./

# Install deps (including dev for build)
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# Build app
RUN npm run build

# ---------- Runner ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only production build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Install ONLY production deps
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /root/.npm

EXPOSE 3000

CMD ["node", "dist/server/server.js"]