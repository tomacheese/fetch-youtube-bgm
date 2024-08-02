FROM node:20 AS builder

WORKDIR /build

COPY package.json yarn.lock ./

RUN echo network-timeout 600000 > .yarnrc && \
  yarn install --frozen-lockfile --non-interactive && \
  yarn cache clean

COPY nuxt.config.ts .
COPY src src

RUN yarn build

FROM node:20 AS runner

WORKDIR /app

COPY --from=builder /build/.output/ /app/

ENV TRACKS_FILE=/data/tracks.json
ENV WEBHOOK_TRACKS_FILE=/data/webhook-tracks.json
ENV TRACKS_DIR=/data/tracks/

ENV PORT=80
EXPOSE 80

CMD ["node", "server/index.mjs"]
