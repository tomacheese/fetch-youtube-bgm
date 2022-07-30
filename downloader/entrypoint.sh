#!/bin/sh

while :
do
  yarn build || true

  echo "Waiting..."

  # wait 1 hour
  sleep 3600
done