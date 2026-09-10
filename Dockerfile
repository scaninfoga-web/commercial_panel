# ---- Stage 1: Dependencies ----
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: Builder ----
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build args (NEXT_PUBLIC_* build-time par inline hote hain)
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY
ARG NEXT_PUBLIC_VIDEO_KYC_URL

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY=$NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY
ENV NEXT_PUBLIC_VIDEO_KYC_URL=$NEXT_PUBLIC_VIDEO_KYC_URL

RUN bun run build

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3009
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3009

CMD ["node", "server.js"]