/* groovylint-disable-next-line CompileStatic */
pipeline {
    agent any
    stages {
        stage('zero') {
            steps {
                echo 'Hello World!'
                sh '''
                    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm install node
                    npm i -g yarn
                '''
            }
        }
        stage('one'){
            sh '''
                yarn
            '''
        }
    }
}
