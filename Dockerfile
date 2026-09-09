FROM node:20-bookworm-slim

# better-sqlite3 and bcrypt are native modules and need a toolchain to build.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
# Containers must bind all interfaces, otherwise the app is unreachable.
ENV HOST=0.0.0.0
ENV PORT=3001
ENV CV_DATA_DIR=/data
ENV STATIC_DIR=/app
# No local Ollama in containers.
ENV AI_DISABLED=1

EXPOSE 3001
CMD ["node", "server.js"]
