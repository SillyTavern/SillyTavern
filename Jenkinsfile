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
                sh '''#!/bin/bash
                export NVM_DIR="$HOME/.nvm"
                [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                '''
                sh '''#!/bin/bash
                nvm install node
                '''
            }
        }
        stage('one') {
            steps {
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
