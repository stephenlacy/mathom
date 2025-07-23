# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i

COPY src ./src
COPY migrations ./migrations
COPY public ./public
COPY drizzle.config.ts .
COPY next.config.ts .
COPY tsconfig.json .
COPY postcss.config.mjs .

ENV NEXT_TELEMETRY_DISABLED 1
