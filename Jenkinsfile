pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        DOCKER_FRONTEND_IMAGE = 'rifathmfm/lms-frontend:${BUILD_NUMBER}'
        DOCKER_FRONTEND_LATEST = 'rifathmfm/lms-frontend:latest'
        BACKEND_API_URL = 'https://your-backend-api-url.com' // Replace with your actual backend URL
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup Environment') {
            steps {
                sh '''
                    mkdir -p nginx/conf.d
                    
                    # Create Nginx config file for frontend
                    cat > nginx/conf.d/default.conf << 'EOL'
server {
    listen 80;
    server_name localhost;
    
    # Root directory for frontend static files
    root /usr/share/nginx/html;
    index index.html;
    
    # Handle Single Page Application routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Optional - proxy API requests to the hosted backend
    location /api/ {
        proxy_pass ${BACKEND_API_URL};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Error handling
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOL
                    
                    # Create a simple Dockerfile for the frontend
                    cat > Dockerfile << 'EOL'
# Build stage
FROM node:16-alpine as build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all frontend source files
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:1.24.0-alpine

# Copy built files to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOL
                '''
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    # Install frontend dependencies
                    npm ci
                '''
            }
        }
        
        stage('Frontend Tests') {
            steps {
                sh '''
                    # Run frontend tests if they exist
                    if grep -q "\"test\":" package.json; then
                        CI=true npm test
                    else
                        echo "No tests found in package.json, skipping test step"
                    fi
                '''
            }
        }
        
        stage('Build Frontend') {
            steps {
                sh '''
                    # Build the frontend application
                    npm run build
                    
                    # Build the Docker image
                    docker build -t ${DOCKER_FRONTEND_IMAGE} .
                    docker tag ${DOCKER_FRONTEND_IMAGE} ${DOCKER_FRONTEND_LATEST}
                '''
            }
        }
        
        stage('Push Image') {
            steps {
                sh '''
                    # Login to Docker Hub
                    echo ${DOCKER_HUB_CREDS_PSW} | docker login -u ${DOCKER_HUB_CREDS_USR} --password-stdin
                    
                    # Push the Docker image
                    docker push ${DOCKER_FRONTEND_IMAGE}
                    docker push ${DOCKER_FRONTEND_LATEST}
                    
                    # Logout from Docker Hub
                    docker logout
                '''
            }
        }
        
        stage('Deploy to Server') {
            when {
                expression { return params.DEPLOY_TO_SERVER }
            }
            steps {
                sh '''
                    # If you have a server to deploy to, add deployment commands here
                    # For example, SSH to your server and pull the new image
                    # ssh user@your-server "docker pull ${DOCKER_FRONTEND_LATEST} && docker-compose up -d"
                    echo "Deployment step - configure as needed"
                '''
            }
        }
    }
    
    post {
        always {
            // Clean up workspace
            cleanWs()
            
            // Clean up Docker images locally if Docker is installed
            sh '''
                if command -v docker &> /dev/null; then
                    docker image prune -af
                else
                    echo "Docker not installed, skipping cleanup"
                fi
            '''
        }
        
        success {
            echo """
            =======================================
            Frontend deployment completed successfully!
            ---------------------------------------
            Frontend Image: ${DOCKER_FRONTEND_IMAGE}
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
    
    parameters {
        booleanParam(name: 'DEPLOY_TO_SERVER', defaultValue: false, description: 'Deploy to production server?')
    }
}