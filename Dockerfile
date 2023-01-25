FROM node:19.1.0-alpine3.16

# Arguments
ARG APP_HOME=/home/node/app

# Create app directory
WORKDIR ${APP_HOME}


# Install app dependencies
COPY package*.json ./
RUN \
  echo "*** Install npm packages ***" && \
  npm install

# Bundle app source
COPY . .

# Copy default chats, characters and user avatars to <folder>.default folder
RUN \
  echo "*** Copy default chats, characters and user avatars to <folder>.default folder ***" && \
  mv "./public/characters"    "./public/characters.default" && \
  mv "./public/chats"         "./public/chats.default" && \
  mv "./public/User Avatars"  "./public/User Avatars.default"

# Cleanup unnecessary files
RUN \
  echo "*** Cleanup ***" && \
  mv "./docker/docker-entrypoint.sh" "./" && \
  rm -rf "./docker" && \
  rm -rf "./.git" && \
  echo "*** Make docker-entrypoint.sh executable ***" && \
  chmod +x "./docker-entrypoint.sh"

EXPOSE 8000

ENTRYPOINT [ "/bin/sh", "-c", "./docker-entrypoint.sh" ]
