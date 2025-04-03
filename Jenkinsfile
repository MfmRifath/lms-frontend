pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        AWS_CREDS = credentials('aws-credentials')
        EC2_SSH_KEY = credentials('aws-ssh-key')
        EC2_IP = '${params.EC2_IP}'
        DOCKER_BACKEND_IMAGE = 'rifathmfm/lms-backend:${BUILD_NUMBER}'
        DOCKER_FRONTEND_IMAGE = 'rifathmfm/lms-frontend:${BUILD_NUMBER}'
        DOCKER_BACKEND_LATEST = 'rifathmfm/lms-backend:latest'
        DOCKER_FRONTEND_LATEST = 'rifathmfm/lms-frontend:latest'
    }
    
    parameters {
        string(name: 'EC2_IP', defaultValue: '', description: 'IP address of the EC2 instance')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip tests if needed for hotfix')
        booleanParam(name: 'CREATE_INFRASTRUCTURE', defaultValue: false, description: 'Create new infrastructure with Terraform')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Setting permissions for SSH key
                    sh "chmod 400 ${EC2_SSH_KEY}"
                }
            }
        }
        
        stage('Setup Environment') {
            steps {
                // Create directories if they don't exist
                sh '''
                    mkdir -p nginx/conf.d
                    
                    # Create Nginx config file if it doesn't exist
                    if [ ! -f nginx/conf.d/default.conf ]; then
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
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files from Django
    location /static/ {
        proxy_pass http://backend:8000;
    }
    
    # Media files from Django
    location /media/ {
        proxy_pass http://backend:8000;
    }
    
    # Error handling
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOL
                    fi
                    
                    # Create Docker Compose file if it doesn't exist
                    if [ ! -f docker-compose.yml ]; then
                        cat > docker-compose.yml << 'EOL'
version: '3.8'

services:
  mongodb:
    image: mongo:6.0.12
    container_name: mongodb
    restart: always
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    networks:
      - lms-network

  backend:
    image: ${DOCKER_BACKEND_LATEST}
    container_name: lms-backend
    restart: always
    depends_on:
      - mongodb
    environment:
      - MONGO_URI=mongodb://admin:password@mongodb:27017/lms?authSource=admin
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DJANGO_DEBUG=False
      - DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,${EC2_IP}
    networks:
      - lms-network

  frontend:
    image: ${DOCKER_FRONTEND_LATEST}
    container_name: lms-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"
    networks:
      - lms-network

networks:
  lms-network:
    driver: bridge

volumes:
  mongodb_data:
EOL
                    fi
                    
                    # Create frontend Dockerfile if it doesn't exist
                    if [ ! -f frontend/Dockerfile ]; then
                        mkdir -p frontend
                        cat > frontend/Dockerfile << 'EOL'
# Build stage
FROM node:16-alpine as build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:1.24.0-alpine

# Copy built files from build stage to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY ../nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOL
                    fi
                '''
                
                // Generate a random Django secret key if not provided
                sh '''
                    if [ -z "$DJANGO_SECRET_KEY" ]; then
                        export DJANGO_SECRET_KEY=$(openssl rand -base64 32)
                        echo "Generated random Django secret key"
                    fi
                '''
            }
        }
        
        stage('Backend Tests') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                sh '''
                    cd backend
                    
                    # Create virtual environment if it doesn't exist
                    if [ ! -d "venv" ]; then
                        python -m venv venv
                    fi
                    
                    source venv/bin/activate
                    pip install -r requirements.txt
                    python manage.py test
                '''
            }
        }
        
        stage('Frontend Tests') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                sh '''
                    cd frontend
                    
                    # Install dependencies if not already installed
                    npm ci
                    
                    # Run tests with CI=true to avoid interactive mode
                    CI=true npm test
                '''
            }
        }
        
        stage('Build Backend') {
            steps {
                sh '''
                    cd backend
                    
                    # Build docker image with build number and latest tag
                    docker build -t ${DOCKER_BACKEND_IMAGE} .
                    docker tag ${DOCKER_BACKEND_IMAGE} ${DOCKER_BACKEND_LATEST}
                '''
            }
        }
        
        stage('Build Frontend') {
            steps {
                sh '''
                    cd frontend
                    
                    # Install dependencies if needed
                    if [ ! -d "node_modules" ]; then
                        npm ci
                    fi
                    
                    # Build the frontend
                    npm run build
                    
                    # Copy Nginx config to frontend directory for Docker build
                    cp -r ../nginx ./nginx
                    
                    # Build docker image with build number and latest tag
                    docker build -t ${DOCKER_FRONTEND_IMAGE} .
                    docker tag ${DOCKER_FRONTEND_IMAGE} ${DOCKER_FRONTEND_LATEST}
                '''
            }
        }
        
        stage('Push Images') {
            steps {
                sh '''
                    # Login to Docker Hub
                    echo ${DOCKER_HUB_CREDS_PSW} | docker login -u ${DOCKER_HUB_CREDS_USR} --password-stdin
                    
                    # Push both versions of the images
                    docker push ${DOCKER_BACKEND_IMAGE}
                    docker push ${DOCKER_BACKEND_LATEST}
                    docker push ${DOCKER_FRONTEND_IMAGE}
                    docker push ${DOCKER_FRONTEND_LATEST}
                    
                    # Logout from Docker Hub
                    docker logout
                '''
            }
        }
        
        stage('Provision Infrastructure') {
            when {
                expression { return params.CREATE_INFRASTRUCTURE }
            }
            steps {
                sh '''
                    cd terraform
                    
                    # Setup AWS credentials
                    export AWS_ACCESS_KEY_ID=${AWS_CREDS_USR}
                    export AWS_SECRET_ACCESS_KEY=${AWS_CREDS_PSW}
                    
                    # Initialize Terraform
                    terraform init
                    
                    # Apply infrastructure changes
                    terraform apply -auto-approve
                    
                    # Export EC2 IP address if available
                    if [ -z "${EC2_IP}" ]; then
                        export EC2_IP=$(terraform output -raw ec2_instance_public_ip)
                        echo "EC2_IP=${EC2_IP}" > ec2_ip.properties
                    fi
                '''
                
                // Load the EC2 IP if it was created by Terraform
                script {
                    if (fileExists('terraform/ec2_ip.properties')) {
                        def props = readProperties file: 'terraform/ec2_ip.properties'
                        env.EC2_IP = props.EC2_IP
                    }
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    if (env.EC2_IP) {
                        // Wait for SSH to be available
                        sh """
                            # Wait for SSH to be available on the instance
                            echo "Waiting for SSH to be available on ${EC2_IP}..."
                            count=0
                            max_retries=20
                            retry_interval=10
                            
                            until ssh -i ${EC2_SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=5 ec2-user@${EC2_IP} 'exit' || [ \$count -eq \$max_retries ]; do
                                echo "Retry \$count of \$max_retries..."
                                sleep \$retry_interval
                                count=\$((count+1))
                            done
                            
                            if [ \$count -eq \$max_retries ]; then
                                echo "Failed to connect to ${EC2_IP} after \$max_retries attempts"
                                exit 1
                            fi
                            
                            # Copy Docker Compose file to EC2 instance
                            scp -i ${EC2_SSH_KEY} -o StrictHostKeyChecking=no docker-compose.yml ec2-user@${EC2_IP}:~/docker-compose.yml
                            
                            # Deploy using Docker Compose
                            ssh -i ${EC2_SSH_KEY} -o StrictHostKeyChecking=no ec2-user@${EC2_IP} '
                                # Install Docker and Docker Compose if not installed
                                if ! command -v docker &> /dev/null; then
                                    sudo yum update -y
                                    sudo amazon-linux-extras install docker -y
                                    sudo service docker start
                                    sudo usermod -a -G docker ec2-user
                                    sudo chkconfig docker on
                                fi
                                
                                if ! command -v docker-compose &> /dev/null; then
                                    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
                                    sudo chmod +x /usr/local/bin/docker-compose
                                fi
                                
                                # Set environment variables
                                export DOCKER_BACKEND_LATEST=${DOCKER_BACKEND_LATEST}
                                export DOCKER_FRONTEND_LATEST=${DOCKER_FRONTEND_LATEST}
                                export DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
                                export EC2_IP=${EC2_IP}
                                
                                # Pull latest images
                                docker-compose pull
                                
                                # Start or update containers
                                docker-compose up -d
                                
                                # Prune old images to save space
                                docker image prune -af
                            '
                        """
                    } else {
                        error "EC2_IP is not set. Please provide an EC2 IP address or enable the CREATE_INFRASTRUCTURE parameter."
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Clean up workspace
            cleanWs()
            
            // Clean up Docker images locally
            sh '''
                docker image prune -af
            '''
        }
        
        success {
            echo """
            =======================================
            Deployment completed successfully!
            ---------------------------------------
            Backend Image: ${DOCKER_BACKEND_IMAGE}
            Frontend Image: ${DOCKER_FRONTEND_IMAGE}
            Deployed to: ${EC2_IP}
            Application URL: http://${EC2_IP}
            =======================================
            """
        }
        
        failure {
            echo """
            =======================================
            Deployment failed! Check the logs for detail.
            =======================================
            """
        }
    }
}