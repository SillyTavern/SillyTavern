FROM node:lts-alpine3.23

# Arguments
ARG APP_HOME=/home/node/app

# Install system dependencies
# "Don't rely on the base image for tools; if you call it, you install it." ;)
RUN apk add --no-cache gcompat tini git git-lfs su-exec shadow dos2unix

# Create app directory and set ownership
WORKDIR ${APP_HOME}
RUN chown node:node ${APP_HOME}

# Set NODE_ENV to production
ENV NODE_ENV=production

# Bundle app source and set ownership
COPY --chown=node:node . ./

RUN \
  echo "*** Install npm packages ***" && \
  npm ci --no-audit --no-fund --loglevel=error --no-progress --omit=dev && npm cache clean --force

# Create config directory and link config.yaml. Added hardcoded dirs(constants.js?)
# that must be present for Non-Root Mode and volumeless docker runs.
RUN \
  rm -f "config.yaml" || true && \
  mkdir -p config data plugins public/scripts/extensions/third-party backups && \
  chown -R node:node config data plugins public/scripts/extensions/third-party backups && \
  ln -s "./config/config.yaml" "config.yaml"

# Pre-compile public libraries
RUN \
  echo "*** Run Webpack ***" && \
  node "./docker/build-lib.js"

# Set the entrypoint script, healthcheck, and cleanup
RUN \
  echo "*** Cleanup ***" && \
  mv "./docker/docker-entrypoint.sh" "./" && \
  mv "./docker/healthcheck.cjs" "./" && \
  echo "*** Make docker-entrypoint.sh executable ***" && \
  chmod +x "./docker-entrypoint.sh" && \
  echo "*** Convert line endings to Unix format ***" && \
  dos2unix "./docker-entrypoint.sh" && \
  rm -rf "./docker"

# Fix extension repos permissions
RUN git config --global --add safe.directory "*"

# Set default heartbeat interval (30 seconds)
ENV SILLYTAVERN_HEARTBEATINTERVAL="30"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node healthcheck.cjs || exit 1

EXPOSE 8000

# Ensure proper handling of kernel signals
ENTRYPOINT ["tini", "--", "./docker-entrypoint.sh"]
