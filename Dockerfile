FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ─── Runtime image ───
FROM oven/bun:1.1-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

ENV DB_PATH=/app/data/sprint-planner.db
ENV PORT=3000

CMD ["bun", "run", "server/index.ts"]
