# ─── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install yarn if not already present
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# Copy package manifests
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=false

# ─── Stage 2: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js production bundle
# Note: Build-time env vars for NEXT_PUBLIC_* must be set here
ARG NEXT_PUBLIC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_GUARDIAN_1
ARG NEXT_PUBLIC_GUARDIAN_2
ARG NEXT_PUBLIC_GUARDIAN_3
ARG NEXT_PUBLIC_DEPLOYER_ADDRESS

ENV NEXT_PUBLIC_CONTRACT_ADDRESS=$NEXT_PUBLIC_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_GUARDIAN_1=$NEXT_PUBLIC_GUARDIAN_1
ENV NEXT_PUBLIC_GUARDIAN_2=$NEXT_PUBLIC_GUARDIAN_2
ENV NEXT_PUBLIC_GUARDIAN_3=$NEXT_PUBLIC_GUARDIAN_3
ENV NEXT_PUBLIC_DEPLOYER_ADDRESS=$NEXT_PUBLIC_DEPLOYER_ADDRESS

RUN yarn build

# ─── Stage 3: Production Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed for production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy contract ABIs (needed by relay at runtime)
COPY --from=builder /app/lib/contracts ./lib/contracts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
