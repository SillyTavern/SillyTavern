/* groovylint-disable-next-line CompileStatic */
pipeline {
    agent any
    tools { nodejs 'nodejs' }
    stages {
        stage('preflight') {
            steps {
                echo sh(returnStdout: true, script: 'env')
                sh 'node -v'
            }
        }
        stage('build') {
            steps {
                sh 'npm --version'
                sh 'git log --reverse -1'
                sh 'npm install'
            }
        }
        // stage('test') {
        //     steps {
        //         sh 'npm test'
        //     }
        // }
    }
}
