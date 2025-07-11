# ========== Build Stage ==========
FROM node:lts-alpine3.21 AS builder

ARG APP_HOME=/home/node/app
WORKDIR ${APP_HOME}

# Set NODE_ENV to production
ENV NODE_ENV=production

# Bundle app source
COPY . ./

# Install production dependencies only
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error --no-progress

# Create config directory and link config.yaml
RUN \
  rm -f "config.yaml" || true && \
  ln -s "./config/config.yaml" "config.yaml" || true && \
  mkdir "config" || true 

# Pre-compile public libraries
RUN node ./docker/build-lib.js

# Set the entrypoint script
RUN mv ./docker/docker-entrypoint.sh ./ && \
    rm -rf ./docker && \
    chmod +x ./docker-entrypoint.sh && \
    dos2unix ./docker-entrypoint.sh

# ========== Runtime Stage ==========
FROM node:lts-alpine3.21 AS runtime

ARG APP_HOME=/home/node/app
WORKDIR ${APP_HOME}

# Set NODE_ENV to production
ENV NODE_ENV=production

# Install system dependencies
RUN apk add --no-cache gcompat tini git git-lfs \
    && mkdir -p ${APP_HOME}/data

# Copy build output and dependencies
COPY --from=builder ${APP_HOME} ${APP_HOME}

# Fix extension repos permissions
RUN git config --global --add safe.directory "*"

EXPOSE 8000

# Ensure proper handling of kernel signals
ENTRYPOINT ["tini", "--", "./docker-entrypoint.sh"]
