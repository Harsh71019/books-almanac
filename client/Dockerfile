FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY shared shared
COPY client client
# Vite bakes VITE_* vars into the bundle at build time, not runtime — has to
# arrive as a build arg, a plain container env var wouldn't be seen by vite build.
ARG VITE_GLITCHTIP_DSN
ENV VITE_GLITCHTIP_DSN=$VITE_GLITCHTIP_DSN
RUN npm run build -w shared && npm run build -w client

FROM nginx:1.29-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
