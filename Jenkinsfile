pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        FRONTEND_IMAGE = 'rifathmfm/lms-frontend:latest'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Verify Tools') {
            steps {
                sh '''
                    # Check if nodejs and npm are installed
                    echo "Node.js version:"
                    node -v || echo "Node.js not installed"
                    
                    echo "npm version:"
                    npm -v || echo "npm not installed"
                    
                    echo "Docker version:"
                    docker -v || echo "Docker not installed"
                '''
            }
        }
        
        stage('Setup Project') {
            steps {
                sh '''
                    # Create a simple package.json if it doesn't exist
                    if [ ! -f package.json ]; then
                        echo '{
                          "name": "lms-frontend",
                          "version": "1.0.0",
                          "scripts": {
                            "build": "echo Building frontend..."
                          }
                        }' > package.json
                    fi
                    
                    # Create a simple index.html if it doesn't exist
                    mkdir -p public
                    if [ ! -f public/index.html ]; then
                        echo '<!DOCTYPE html>
                        <html>
                        <head>
                            <title>LMS Frontend</title>
                        </head>
                        <body>
                            <h1>Learning Management System</h1>
                            <p>Frontend application successfully deployed!</p>
                        </body>
                        </html>' > public/index.html
                    fi
                    
                    # Create nginx config directory and file
                    mkdir -p nginx/conf.d
                    echo 'server {
                        listen 80;
                        server_name localhost;
                        
                        root /usr/share/nginx/html;
                        index index.html;
                        
                        location / {
                            try_files $uri $uri/ /index.html;
                        }
                    }' > nginx/conf.d/default.conf
                    
                    # Create a simple Dockerfile
                    echo 'FROM nginx:1.24.0-alpine
                    
                    COPY public /usr/share/nginx/html
                    COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf
                    
                    EXPOSE 80
                    
                    CMD ["nginx", "-g", "daemon off;"]' > Dockerfile
                '''
            }
        }
        
        stage('Build') {
            steps {
                sh '''
                    # Run the build script from package.json (or skip if npm not installed)
                    if command -v npm &> /dev/null; then
                        npm run build
                    else
                        echo "Skipping npm build, using static files in public/ directory"
                    fi
                    
                    # Build Docker image if Docker is installed
                    if command -v docker &> /dev/null; then
                        docker build -t ${FRONTEND_IMAGE} .
                    else
                        echo "Docker not installed, skipping image build"
                        exit 1
                    fi
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                sh '''
                    # Push to Docker Hub if Docker is installed
                    if command -v docker &> /dev/null; then
                        echo ${DOCKER_HUB_CREDS_PSW} | docker login -u ${DOCKER_HUB_CREDS_USR} --password-stdin
                        docker push ${FRONTEND_IMAGE}
                        docker logout
                    else
                        echo "Docker not installed, skipping deployment"
                        exit 1
                    fi
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        
        success {
            echo """
            =======================================
            Frontend deployment completed successfully!
            ---------------------------------------
            Frontend Image: ${FRONTEND_IMAGE}
            =======================================
            """
        }
        
        failure {
            echo """
            =======================================
            Deployment failed! Check the logs for details.
            =======================================
            """
        }
    }
}