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
            }
        }
        stage('one') {
            steps {
                sh '''
                yarn
            '''
            }
        }
    }
}
