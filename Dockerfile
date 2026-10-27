# The official Playwright image ships Chromium together with every system
# library it needs. Installing a browser into node:slim by hand means
# chasing missing .so files on every base-image bump; this does not.
# The tag pins both Playwright and the browser build, so the offer PDF
# keeps looking the same after a rebuild.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

# bcrypt is a native module and needs a toolchain to build.
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
# The image already carries the browsers; Playwright must not look elsewhere.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3001
CMD ["node", "server.js"]
