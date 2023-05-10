/* groovylint-disable-next-line CompileStatic */
pipeline {
    agent any
    stages {
        stage('zero') {
            steps {
                echo 'Hello World!!s'
                sh 'bash -l -c ". $HOME/.nvm/nvm.sh ; nvm use || nvm install && nvm use"'
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
