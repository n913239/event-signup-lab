#!/bin/bash
# 你手動跑:主機上的受測複本(給 A 用)與 Webwright venv
set -e
G=<github>; L=$G/tmp/es-web-lab
cd $L
grep -q '^JWT_SECRET=.\+' .dev.vars || sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/; s/^QR_SECRET=.*/QR_SECRET=$(openssl rand -hex 32)/" .dev.vars
npm ci && (cd web && npm ci)
cd $G/webwright-lab && python3 -m venv .venv && .venv/bin/pip install -e .
.venv/bin/python -c 'import playwright, webwright; print("host setup ok")'
