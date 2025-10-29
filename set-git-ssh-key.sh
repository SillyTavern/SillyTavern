#!/bin/bash
KEYFILE_NAME="$HOME/.ssh/silly.tavern.deploy"
chmod 400 ${KEYFILE_NAME}
git config core.sshCommand "ssh -i ${KEYFILE_NAME} -o IdentitiesOnly=yes"
