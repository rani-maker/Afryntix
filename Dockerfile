# ============================================================
# AFRYNTIX — Dockerfile multi-stage (Next.js 15 standalone)
# ============================================================

FROM public.ecr.aws/docker/library/node:20-slim AS base

# ---- Dépendances ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de build (placeholders — remplacées par les vraies valeurs en runtime)
ENV DATABASE_URL="postgresql://build:build@localhost/build"
ENV DIRECT_URL="postgresql://build:build@localhost/build"
ENV AUTH_SECRET="build-placeholder-secret-32-characters"
ENV AUTH_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_NAME="AFRYNTIX"
ENV NEXT_PUBLIC_COMPANY_TAGLINE="Transport & Logistique Chine - Afrique de l'Ouest"

RUN npm run build

# ---- Runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
