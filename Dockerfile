FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN if [ -f package-lock.json ]; then cp package-lock.json .; fi
RUN npm install --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars must be available at build time
ARG NEXT_PUBLIC_MINIO_URL
ARG NEXT_PUBLIC_APP_URL

# Server-side vars needed at build time for static page generation
ARG NEO4J_URI=neo4j://localhost:7687
ARG NEO4J_USER=neo4j
ARG NEO4J_PASSWORD=dummy
ARG JWT_SECRET=build-time-placeholder
ARG MINIO_ENDPOINT=localhost
ARG MINIO_PORT=9000
ARG MINIO_ACCESS_KEY=dummy
ARG MINIO_SECRET_KEY=dummy
ARG MINIO_BUCKET_NAME=product-images
ARG MINIO_USE_SSL=false

ENV NEXT_PUBLIC_MINIO_URL=$NEXT_PUBLIC_MINIO_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEO4J_URI=$NEO4J_URI
ENV NEO4J_USER=$NEO4J_USER
ENV NEO4J_PASSWORD=$NEO4J_PASSWORD
ENV JWT_SECRET=$JWT_SECRET
ENV MINIO_ENDPOINT=$MINIO_ENDPOINT
ENV MINIO_PORT=$MINIO_PORT
ENV MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
ENV MINIO_SECRET_KEY=$MINIO_SECRET_KEY
ENV MINIO_BUCKET_NAME=$MINIO_BUCKET_NAME
ENV MINIO_USE_SSL=$MINIO_USE_SSL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
