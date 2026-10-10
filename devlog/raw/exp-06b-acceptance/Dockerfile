# 地端兩條(B: Pi、C: Webwright harness)的隔離環境。受測站與 agent 在同一個容器裡,
# 路徑跟 9/28 相同,讓 prompt 不必改路徑。容器看不到主機家目錄;LM Studio 透過主機上的 auth-proxy。
FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv python3-pip sqlite3 jq curl && rm -rf /var/lib/apt/lists/*
ENV G=<github>
COPY tmp/es-web-lab $G/tmp/es-web-lab
COPY webwright-lab $G/webwright-lab
RUN cd $G/tmp/es-web-lab && npm ci && cd web && npm ci
RUN cd $G/webwright-lab && python3 -m venv .venv && .venv/bin/pip install -e . && .venv/bin/playwright install --with-deps chromium
RUN npm install -g @earendil-works/pi-coding-agent@0.84.2
RUN mkdir -p /root/.pi/agent && cat > /root/.pi/agent/models.json <<'JSON'
{"providers":{"lmstudio":{"baseUrl":"http://host.docker.internal:1235/v1","api":"openai-completions","apiKey":"via-proxy",
 "models":[{"id":"qwen3.6-35b-a3b-mlx","name":"Qwen3.6 35B-A3B (local MoE, 4-bit MLX)","reasoning":true,"input":["text"],
 "contextWindow":32768,"maxTokens":8192,"samplingParams":{"temperature":1.0,"top_p":0.95,"top_k":20},
 "compat":{"supportsDeveloperRole":false,"supportsReasoningEffort":false}}]}}}
JSON
