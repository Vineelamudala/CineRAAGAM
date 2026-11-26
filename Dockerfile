# syntax=docker/dockerfile:1.7
# Cineraagam web app — production image (Next.js standalone server).
# The image contains no secrets: only the PUBLIC Supabase URL and publishable
# (anon) key are baked in at build time (Next.js inlines NEXT_PUBLIC_* values).

# ---- dependencies ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: skip the Supabase CLI binary download (not needed in the image)
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# ---- operator tools (admin accounts, catalogue import) ----
FROM node:24-alpine AS tools
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
COPY lib/catalog ./lib/catalog
USER node
CMD ["node", "scripts/admin.mjs", "list"]

# ---- runtime ----
FROM node:24-alpine AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
