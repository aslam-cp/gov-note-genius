# Stage 1: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
# We need to make sure the target is Node/Bun, which will be handled in vite.config.ts
RUN bun run build

# Stage 2: Runner
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Copy the built output from the builder stage
# TanStack Start typically outputs to .output or dist/server depending on config
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the application port
EXPOSE 8080

# Use a non-root user for security
USER bun

# Start the application
# The start command depends on the TanStack Start output. 
# Usually it's 'bun .output/server/index.mjs' or similar.
CMD ["bun", ".output/server/index.mjs"]
