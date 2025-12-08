# v0.8.1-rc2

# Base node image
FROM node:20-alpine AS node

# Install jemalloc
RUN apk add --no-cache jemalloc
RUN apk add --no-cache python3 py3-pip uv

# Set environment variable to use jemalloc
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

# Add `uv` for extended MCP support
COPY --from=ghcr.io/astral-sh/uv:0.6.13 /uv /uvx /bin/
RUN uv --version

RUN mkdir -p /app && chown node:node /app
WORKDIR /app

USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node api/package.json ./api/package.json
COPY --chown=node:node client/package.json ./client/package.json
COPY --chown=node:node docs/package.json ./docs/package.json
COPY --chown=node:node packages/data-provider/package.json ./packages/data-provider/package.json
COPY --chown=node:node packages/data-schemas/package.json ./packages/data-schemas/package.json
COPY --chown=node:node packages/api/package.json ./packages/api/package.json
COPY --chown=node:node packages/intent-analyzer/package.json ./packages/intent-analyzer/package.json
COPY --chown=node:node packages/guardrails/package.json ./packages/guardrails/package.json
COPY --chown=node:node packages/datadog-llm-observability/package.json ./packages/datadog-llm-observability/package.json
COPY --chown=node:node packages/doc-viewer/package.json ./packages/doc-viewer/package.json
COPY --chown=node:node packages/client/package.json ./packages/client/package.json

RUN \
    # Allow mounting of these files, which have no default
    touch .env ; \
    # Create directories for the volumes to inherit the correct permissions
    mkdir -p /app/client/public/images /app/api/logs /app/uploads ; \
    npm config set fetch-retry-maxtimeout 600000 ; \
    npm config set fetch-retries 5 ; \
    npm config set fetch-retry-mintimeout 15000 ; \
    npm ci --no-audit

COPY --chown=node:node . .

RUN \
    # React client build (includes docs via frontend script)
    NODE_OPTIONS="--max-old-space-size=4096" npm run frontend; \
    npm prune --production; \
    npm cache clean --force

# Verify docs build output
RUN echo "=== VERIFYING DOCS BUILD ===" && \
    ls -la /app/docs/out/ 2>/dev/null && echo "✅ docs/out directory found" || echo "⚠️ docs/out not found (search disabled)" && \
    echo "=== DOCS VERIFICATION COMPLETE ==="

# Node API setup
EXPOSE 3080
ENV HOST=0.0.0.0
CMD ["npm", "run", "backend"]

# Optional: for client with nginx routing
# FROM nginx:stable-alpine AS nginx-client
# WORKDIR /usr/share/nginx/html
# COPY --from=node /app/client/dist /usr/share/nginx/html
# COPY client/nginx.conf /etc/nginx/conf.d/default.conf
# ENTRYPOINT ["nginx", "-g", "daemon off;"]
