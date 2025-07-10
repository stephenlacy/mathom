#!/bin/bash

docker build -t mathon-node:22.12-alpine -f node:22.12-alpine .
docker build -t mathom-node:22.12-alpine-mathom-proxy -f node:22.12-alpine-mathom-proxy .
