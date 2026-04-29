# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies)
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
# Build-time variables for Vite env injection
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy build artifacts and package manifest from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install ONLY production dependencies to keep the final image size minimal
RUN npm install --omit=dev

EXPOSE 3000

# Run the production server
CMD ["node", "dist/server/server.js"]


