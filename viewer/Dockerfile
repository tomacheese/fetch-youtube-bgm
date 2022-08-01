FROM php:8-alpine

RUN apk update && \
  apk upgrade

WORKDIR /app

COPY src/ src/
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
