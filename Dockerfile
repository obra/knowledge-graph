FROM node:22-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

ENV KG_VAULT_PATH=/vault
ENV KG_DATA_DIR=/root/.local/share/knowledge-graph

ENTRYPOINT ["npx", "tsx", "src/cli/index.ts"]
