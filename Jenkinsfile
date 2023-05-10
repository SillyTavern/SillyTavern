/* groovylint-disable-next-line CompileStatic */
pipeline {
    agent any
    stages {
        stage('zero') {
            steps {
                echo 'Hello World!'
                sh '''#!/bin/bash
                    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
                '''
                /* groovylint-disable-next-line GStringExpressionWithinString */
                sh '''#!/bin/bash
                    /* groovylint-disable-next-line LineLength */
                    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                '''
            }
        }
        stage('one') {
            steps {
                sh '''#!/bin/bash
                nvm install node
                '''
                sh '''#!/bin/bash
                npm i -g yarn
                '''
                sh '''#!/bin/bash
                yarn
                '''
            }
        }
    }
}
