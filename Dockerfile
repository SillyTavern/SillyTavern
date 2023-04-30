FROM node:19.1.0-alpine3.16

# Arguments
ARG APP_HOME=/home/node/app

# Install system dependencies
RUN apk add gcompat tini

# Ensure proper handling of kernel signals
ENTRYPOINT [ "tini", "--" ]

# Create app directory
WORKDIR ${APP_HOME}

# Install app dependencies
COPY package*.json ./
RUN \
  echo "*** Install npm packages ***" && \
  npm install && npm cache clean --force

# Bundle app source
COPY . ./

# Copy default chats, characters and user avatars to <folder>.default folder
RUN \
  IFS="," RESOURCES="characters,chats,User Avatars,settings.json" && \
  \
  echo "*** Store default $RESOURCES in <folder>.default ***" && \
  for R in $RESOURCES; do mv "public/$R" "public/$R.default"; done && \
  \
  echo "*** Create symbolic links to config directory ***" && \
  for R in $RESOURCES; do ln -s "../config/$R" "public/$R"; done && \
  mkdir "config"

# Cleanup unnecessary files
RUN \
  echo "*** Cleanup ***" && \
  mv "./docker/docker-entrypoint.sh" "./" && \
  rm -rf "./docker" && \
  echo "*** Make docker-entrypoint.sh executable ***" && \
  chmod +x "./docker-entrypoint.sh" && \
  echo "*** Convert line endings to Unix format ***" && \
  dos2unix "./docker-entrypoint.sh"

EXPOSE 8000

CMD [ "./docker-entrypoint.sh" ]
