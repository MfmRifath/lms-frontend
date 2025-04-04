pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
        FRONTEND_IMAGE = 'rifathmfm/lms-frontend:latest'
        PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
        TF_VAR_public_key_path = "${env.WORKSPACE}/ssh_key.pub"
        EC2_USER = "ec2-user"
        EC2_DNS = "ec2-13-218-208-239.compute-1.amazonaws.com"
        EC2_INSTANCE_ID = "i-065a1c89b95538cbb"
        
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
                    
                    # Check Terraform version
                    terraform --version || echo "Terraform not installed"
                    
                    # Check AWS CLI version
                    aws --version || echo "AWS CLI not installed"
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
                    
                    # Generate SSH key pair for EC2 access - FORCE OVERWRITE
                    rm -f ssh_key ssh_key.pub
                    ssh-keygen -t rsa -b 2048 -f ssh_key -N "" -q
                    chmod 400 ssh_key
                    
                    # Create Terraform directory
                    mkdir -p terraform
                    
                    # Create main.tf
                    cat > terraform/main.tf <<'EOF'
provider "aws" {
  region = var.aws_region
}

resource "aws_security_group" "lms_frontend_sg" {
  name        = "lms-frontend-sg"
  description = "Security group for LMS Frontend"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "lms-frontend-sg"
  }
}

resource "aws_key_pair" "lms_key_pair" {
  key_name   = "lms-key-pair"
  public_key = file(var.public_key_path)
}

resource "aws_instance" "lms_frontend" {
  ami                    = var.instance_ami
  instance_type          = var.instance_type
  key_name               = aws_key_pair.lms_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.lms_frontend_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              # Update and install Docker
              yum update -y
              amazon-linux-extras install docker -y
              service docker start
              systemctl enable docker
              usermod -a -G docker ec2-user
              
              # Signal that the instance is ready by creating a file
              touch /tmp/instance-ready
              EOF

  tags = {
    Name = "lms-frontend-instance"
  }
}
EOF

                    # Create variables.tf
                    cat > terraform/variables.tf <<'EOF'
variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "instance_ami" {
  description = "AMI ID for the EC2 instance (Amazon Linux 2)"
  type        = string
  default     = "ami-0230bd60aa48260c6" # Amazon Linux 2 in us-east-1
}

variable "public_key_path" {
  description = "Path to the public key for SSH access"
  type        = string
}
EOF

                    # Create outputs.tf
                    cat > terraform/outputs.tf <<'EOF'
output "ec2_instance_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.lms_frontend.public_ip
}

output "ec2_instance_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_instance.lms_frontend.public_dns
}

output "ec2_instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.lms_frontend.id
}
EOF
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
                    
                    # Build Docker image with explicit dockerfile path
                    echo "Building Docker image: ${FRONTEND_IMAGE}"
                    $DOCKER_CMD build -f dockerfile.nginx -t ${FRONTEND_IMAGE} .
                '''
            }
        }
        
        stage('Push to Docker Hub') {
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
        
        stage('Provision EC2 with Terraform') {
            steps {
                sh '''
                    cd terraform
                    
                    # Initialize Terraform
                    terraform init
                    
                    # Plan the deployment
                    terraform plan -out=tfplan -var "public_key_path=${TF_VAR_public_key_path}"
                    
                    # Apply the Terraform configuration
                    terraform apply -auto-approve tfplan
                    
                    # Extract the EC2 instance information for later use
                    echo "$(terraform output -json)" > ../terraform_output.json
                    
                    # Extract the public DNS and instance ID for SSH access
                    EC2_DNS=$(terraform output -raw ec2_instance_dns)
                    EC2_IP=$(terraform output -raw ec2_instance_ip)
                    EC2_INSTANCE_ID=$(terraform output -raw ec2_instance_id)
                    
                    echo "EC2_DNS=${EC2_DNS}" > ../ec2_info.properties
                    echo "EC2_IP=${EC2_IP}" >> ../ec2_info.properties
                    echo "EC2_INSTANCE_ID=${EC2_INSTANCE_ID}" >> ../ec2_info.properties
                    
                    echo "EC2 Instance provisioned at: ${EC2_DNS}"
                    echo "EC2 Instance ID: ${EC2_INSTANCE_ID}"
                '''
            }
        }
        
        stage('Deploy with Direct SSH') {
    steps {
        sh '''
            # Set permissions on SSH key
            chmod 400 ssh_key
            
            # Wait for EC2 instance to be status OK (much faster than SSH polling)
            echo "Waiting for EC2 instance to be ready (status check)..."
            aws ec2 wait instance-status-ok --region us-east-1 --instance-ids ${EC2_INSTANCE_ID} || true
            
            # Add additional wait time after instance status check
            echo "Instance passed status check, waiting 60 more seconds for SSH to be ready..."
            sleep 60
            
            # Create a deployment script
            cat > deploy-script.sh <<EOF
#!/bin/bash
set -e

echo "Starting deployment script on EC2 instance..."

# Update system packages
echo "Updating system packages..."
sudo yum update -y

# Check if Docker is installed, install if not
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo amazon-linux-extras install docker -y
    sudo service docker start
    sudo systemctl enable docker
    sudo usermod -aG docker ec2-user
else
    echo "Docker is already installed"
fi

# Pull the Docker image
echo "Pulling Docker image: ${FRONTEND_IMAGE}"
sudo docker pull ${FRONTEND_IMAGE}

# Stop and remove existing container if it exists
echo "Stopping any existing container..."
sudo docker stop lms-frontend || true
sudo docker rm lms-frontend || true

# Run the new container
echo "Starting new container..."
sudo docker run -d --name lms-frontend -p 80:80 --restart unless-stopped ${FRONTEND_IMAGE}

# Verify the container is running
echo "Verifying container is running..."
sudo docker ps | grep lms-frontend

echo "Deployment completed successfully!"
EOF
            
            # Make the script executable
            chmod +x deploy-script.sh
            
            # Directly SSH into the EC2 instance and run the deploy script
            echo "Connecting to EC2 instance and running deployment script..."
            ssh -i ssh_key ec2-user@${EC2_DNS} 'bash -s' < deploy-script.sh
            
            echo "Deployment completed successfully!"
            echo "Application is now available at: http://${EC2_DNS}"
        '''
    }
}
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'ssh_key, ssh_key.pub, ec2_info.properties, terraform_output.json, deploy-script.sh', allowEmptyArchive: true
        }
        
        success {
            sh '''
                # Load EC2 info
                if [ -f ec2_info.properties ]; then
                    source ec2_info.properties
                fi
                
                echo """
                =======================================
                Frontend deployment completed successfully!
                ---------------------------------------
                Frontend Image: ${FRONTEND_IMAGE}
                EC2 Instance DNS: ${EC2_DNS:-Not Available}
                EC2 Instance IP: ${EC2_IP:-Not Available}
                Application URL: http://${EC2_DNS:-Not Available}
                =======================================
                """
            '''
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