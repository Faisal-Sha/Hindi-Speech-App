# syntax=docker/dockerfile:1

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./

FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
