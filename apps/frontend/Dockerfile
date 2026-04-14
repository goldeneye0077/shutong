FROM node:20-alpine

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json

COPY . .

RUN pnpm install --filter frontend... --frozen-lockfile=false

WORKDIR /workspace/apps/frontend

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
