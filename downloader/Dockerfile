FROM buildpack-deps:bullseye AS echogen-builder

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

FROM node:24 AS runner

# hadolint ignore=DL3008
RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install --no-install-recommends -y \
  curl \
  ffmpeg \
  gir1.2-gstreamer-1.0 \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-ugly \
  libboost-dev \
  libtag1-dev \
  mp3gain \
  python3 \
  python3-dev \
  python3-gi \
  python3-pip \
  zlib1g-dev \
  sox \
  libsox-fmt-mp3 \
  libmp3lame0 \
  libmad0 \
  unzip \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY --from=echogen-builder /usr/local/bin/echoprint-codegen /usr/local/bin/echoprint-codegen

WORKDIR /app

COPY package.json yarn.lock requirements.txt ./

# hadolint ignore=DL3016
RUN echo network-timeout 600000 > .yarnrc && \
  yarn install --frozen-lockfile && \
  npm install --force @img/sharp-linux-x64 && \
  yarn cache clean && \
  pip install --no-cache-dir --upgrade --break-system-packages --requirement requirements.txt

# renovate: datasource=github-tags depName=yt-dlp/yt-dlp versioning=loose
ENV YT_DLP_VERSION=2026.08.19
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp -o /usr/local/bin/yt-dlp && \
  chmod a+rx /usr/local/bin/yt-dlp

# yt-dlp は署名解読・PO Token 生成に外部 JS ランタイムを要求する。
# 未導入だと "No supported JavaScript runtime" 警告の末に 403 で失敗する。
# deno はデフォルト有効かつ最も制限された権限で動くため採用する。
# renovate: datasource=github-releases depName=denoland/deno versioning=semver
ENV DENO_VERSION=v2.9.6
RUN curl -fsSL https://github.com/denoland/deno/releases/download/${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
  unzip /tmp/deno.zip -d /usr/local/bin && \
  rm /tmp/deno.zip && \
  chmod a+rx /usr/local/bin/deno

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

COPY src src
COPY tsconfig.json .

ENV LOG_DIR=/data/logs
ENV CONFIG_PATH=/data/config.json
ENV NORMALIZE_VOLUME_APP=mp3gain
# ENV NORMALIZE_VOLUME_APP=rgain3

ENTRYPOINT [ "/app/entrypoint.sh" ]
