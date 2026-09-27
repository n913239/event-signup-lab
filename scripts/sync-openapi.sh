#!/bin/sh
# iOS client 由 openapi.yaml 產生;契約只有一份,改了就同步一次。
cd "$(dirname "$0")/.." && cp openapi.yaml ios/EventSignup/Sources/EventSignup/openapi.yaml
