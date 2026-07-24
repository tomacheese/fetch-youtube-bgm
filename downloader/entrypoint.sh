#!/bin/sh

while :
do
  yarn build || true

  echo "Process exited. Restarting in 10 seconds..."
  sleep 10
done