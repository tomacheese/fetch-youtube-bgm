FROM buildpack-deps:bullseye as builder

WORKDIR /build

# hadolint ignore=DL3008
RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install --no-install-recommends -y libboost-dev libtag1-dev zlib1g-dev && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  git clone https://github.com/spotify/echoprint-codegen.git

WORKDIR /build/echoprint-codegen/src
RUN make

WORKDIR /build/echoprint-codegen
RUN cp echoprint-codegen /usr/local/bin/

WORKDIR /build
RUN rm -rf echoprint-codegen

FROM node:21 as runner

# hadolint ignore=DL3008
RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install --no-install-recommends -y software-properties-common && \
  apt-get update && \
  apt-get install --no-install-recommends -y ffmpeg curl python3 mp3gain libboost-dev libtag1-dev zlib1g-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/echoprint-codegen /usr/local/bin/echoprint-codegen

WORKDIR /app

COPY package.json .
COPY yarn.lock .
RUN echo network-timeout 600000 > .yarnrc && \
  yarn install --frozen-lockfile && \
  yarn cache clean

# renovate: datasource=github-tags depName=yt-dlp/yt-dlp versioning=loose
ENV YT_DLP_VERSION=2023.10.13
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp -o /usr/local/bin/yt-dlp && \
  chmod a+rx /usr/local/bin/yt-dlp

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

COPY src src
COPY tsconfig.json .

ENV LOG_DIR /data/logs

ENTRYPOINT [ "/app/entrypoint.sh" ]
