pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        FRONTEND_IMAGE = 'rifathmfm/lms-frontend:latest'
        PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
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
                    # Check PATH and environment
                    echo "Current PATH: $PATH"
                    echo "Current user: $(id)"
                    
                    # Check if nodejs and npm are installed
                    echo "Node.js version:"
                    node -v || echo "Node.js not installed"
                    
                    echo "npm version:"
                    npm -v || echo "npm not installed"
                    
                    echo "Docker version:"
                    docker -v || echo "Docker not found in PATH"
                    
                    # Check common Docker locations
                    [ -x "/usr/local/bin/docker" ] && echo "Docker found at /usr/local/bin/docker" || echo "No Docker at /usr/local/bin"
                    [ -x "/opt/homebrew/bin/docker" ] && echo "Docker found at /opt/homebrew/bin/docker" || echo "No Docker at /opt/homebrew/bin"
                    
                    # Check Docker socket
                    ls -la /var/run/docker.sock 2>/dev/null || echo "Docker socket not found or not accessible"
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
                    # Find Docker command
                    DOCKER_CMD=""
                    if command -v docker &> /dev/null; then
                        DOCKER_CMD="docker"
                    elif [ -x "/usr/local/bin/docker" ]; then
                        DOCKER_CMD="/usr/local/bin/docker"
                    elif [ -x "/opt/homebrew/bin/docker" ]; then
                        DOCKER_CMD="/opt/homebrew/bin/docker"
                    else
                        echo "Docker not found in common locations, please verify installation"
                        echo "Searched in PATH, /usr/local/bin, and /opt/homebrew/bin"
                        exit 1
                    fi
                    
                    echo "Using Docker command: $DOCKER_CMD"
                    
                    # Run the build script from package.json (or skip if npm not installed)
                    if command -v npm &> /dev/null; then
                        echo "Installing npm dependencies..."
                        npm ci || npm install  # Faster CI install if package-lock.json exists
                        
                        # Check if we're using a React app that needs build
                        if grep -q "react-scripts" package.json; then
                            echo "Building React application..."
                            npm run build
                            
                            # If build succeeded, copy build files to public directory for Docker
                            if [ -d "build" ]; then
                                echo "Copying React build output to public directory..."
                                rm -rf public/*
                                cp -r build/* public/
                            fi
                        else
                            echo "Running standard build script..."
                            npm run build
                        fi
                    else
                        echo "Skipping npm build, using static files in public/ directory"
                    fi
                    
                    # Create a clean Dockerfile directly in the workspace (not in /tmp)
                    echo "# Generated Dockerfile for Docker build" > dockerfile.nginx
                    echo "FROM nginx:1.24.0-alpine" >> dockerfile.nginx
                    echo "" >> dockerfile.nginx
                    echo "COPY public /usr/share/nginx/html" >> dockerfile.nginx
                    echo "COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf" >> dockerfile.nginx
                    echo "" >> dockerfile.nginx
                    echo "EXPOSE 80" >> dockerfile.nginx
                    echo "" >> dockerfile.nginx
                    echo 'CMD ["nginx", "-g", "daemon off;"]' >> dockerfile.nginx
                    
                    echo "Created workspace Dockerfile with contents:"
                    cat dockerfile.nginx
                    
                    # Verify nginx config exists
                    if [ ! -f nginx/conf.d/default.conf ]; then
                        echo "Nginx config not found. Creating config..."
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
                        
                        echo "Nginx config created."
                    fi
                    
                    # List files to verify
                    echo "Content of current directory:"
                    ls -la
                    
                    echo "Content of public directory:"
                    ls -la public || echo "Public directory not found"
                    
                    # Build Docker image with explicit dockerfile path
                    echo "Building Docker image: ${FRONTEND_IMAGE}"
                    $DOCKER_CMD build -f dockerfile.nginx -t ${FRONTEND_IMAGE} .
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                sh '''
                    # Find Docker command (same as in Build stage)
                    DOCKER_CMD=""
                    if command -v docker &> /dev/null; then
                        DOCKER_CMD="docker"
                    elif [ -x "/usr/local/bin/docker" ]; then
                        DOCKER_CMD="/usr/local/bin/docker"
                    elif [ -x "/opt/homebrew/bin/docker" ]; then
                        DOCKER_CMD="/opt/homebrew/bin/docker"
                    else
                        echo "Docker not found in common locations, please verify installation"
                        exit 1
                    fi
                    
                    echo "Using Docker command: $DOCKER_CMD"
                    
                    # Push to Docker Hub
                    echo "Logging in to Docker Hub as ${DOCKER_HUB_CREDS_USR}"
                    echo ${DOCKER_HUB_CREDS_PSW} | $DOCKER_CMD login -u ${DOCKER_HUB_CREDS_USR} --password-stdin
                    
                    echo "Pushing image: ${FRONTEND_IMAGE}"
                    $DOCKER_CMD push ${FRONTEND_IMAGE}
                    
                    echo "Logging out from Docker Hub"
                    $DOCKER_CMD logout
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