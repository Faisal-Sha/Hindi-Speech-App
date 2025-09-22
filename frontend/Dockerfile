# syntax=docker/dockerfile:1

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./

FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

FROM base AS build
ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS production
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/ssl /var/www/certbot \
    && openssl req -x509 -nodes -days 365 \
      -subj "/C=US/ST=State/L=City/O=HindiSpeech/CN=localhost" \
      -out /etc/nginx/ssl/selfsigned.crt \
      -keyout /etc/nginx/ssl/selfsigned.key
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/ /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/*.sh
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
