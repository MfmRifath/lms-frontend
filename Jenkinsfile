pipeline {
    agent any

    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
        FRONTEND_IMAGE = 'rifathmfm/lms-frontend:latest'
        EC2_USER = "ec2-user"
        EC2_DNS = "ec2-13-218-208-239.compute-1.amazonaws.com"
        EC2_INSTANCE_ID = "i-065a1c89b95538cbb"
    
        
        // Path to the PEM file for EC2 access (ensure it’s the correct path)
        EC2_SSH_KEY_PATH = '/Users/your-username/Downloads/lms-key-pair.pem'  // Replace 'your-username' with your actual username
        EC2_INSTANCE_IP = '54.172.172.181'  // Specify your EC2 instance IP
        KEY_PAIR_NAME = 'lms-key-pair'  // The name of your EC2 key pair
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
                    echo "Checking tools availability"
                    echo "Node.js version:"
                    node -v || echo "Node.js not installed"
                    
                    echo "npm version:"
                    npm -v || echo "npm not installed"
                    
                    echo "Docker version:"
                    docker -v || echo "Docker not found in PATH"
                    
                    terraform --version || echo "Terraform not installed"
                    
                    aws --version || echo "AWS CLI not installed"
                '''
            }
        }

        stage('Setup Project') {
            steps {
                sh '''
                    # Create a basic package.json if not exists
                    if [ ! -f package.json ]; then
                        echo '{
                          "name": "lms-frontend",
                          "version": "1.0.0",
                          "scripts": {
                            "build": "echo Building frontend..."
                          }
                        }' > package.json
                    fi

                    # Create an index.html if not exists
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
                    
                    # Generate SSH key pair
                    rm -f ssh_key ssh_key.pub
                    ssh-keygen -t rsa -b 2048 -f ssh_key -N "" -q
                    chmod 400 ssh_key

                    # Create Terraform configuration files (main.tf, variables.tf, outputs.tf)
                    mkdir -p terraform
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
              
              # Signal that the instance is ready
              touch /tmp/instance-ready
              EOF

  tags = {
    Name = "lms-frontend-instance"
  }
}
EOF

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
  description = "AMI ID for the EC2 instance"
  type        = string
  default     = "ami-0230bd60aa48260c6" # Amazon Linux 2 in us-east-1
}

variable "public_key_path" {
  description = "Path to the public key for SSH access"
  type        = string
}
EOF

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
                    DOCKER_CMD=""
                    if command -v docker &> /dev/null; then
                        DOCKER_CMD="docker"
                    elif [ -x "/usr/local/bin/docker" ]; then
                        DOCKER_CMD="/usr/local/bin/docker"
                    elif [ -x "/opt/homebrew/bin/docker" ]; then
                        DOCKER_CMD="/opt/homebrew/bin/docker"
                    else
                        echo "Docker not found"
                        exit 1
                    fi
                    
                    echo "Using Docker command: $DOCKER_CMD"
                    
                    if command -v npm &> /dev/null; then
                        npm ci || npm install
                        if grep -q "react-scripts" package.json; then
                            npm run build
                            if [ -d "build" ]; then
                                rm -rf public/*
                                cp -r build/* public/
                            fi
                        else
                            npm run build
                        fi
                    else
                        echo "Skipping npm build, using static files"
                    fi
                    
                    echo "Building Docker image: ${FRONTEND_IMAGE}"
                    $DOCKER_CMD build -f dockerfile.nginx -t ${FRONTEND_IMAGE} .
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    DOCKER_CMD=""
                    if command -v docker &> /dev/null; then
                        DOCKER_CMD="docker"
                    elif [ -x "/usr/local/bin/docker" ]; then
                        DOCKER_CMD="/usr/local/bin/docker"
                    elif [ -x "/opt/homebrew/bin/docker" ]; then
                        DOCKER_CMD="/opt/homebrew/bin/docker"
                    else
                        echo "Docker not found"
                        exit 1
                    fi
                    
                    echo "Using Docker command: $DOCKER_CMD"
                    $DOCKER_CMD push ${FRONTEND_IMAGE}
                '''
            }
        }

        stage('Terraform Apply') {
            steps {
                sh '''
                    cd terraform
                    terraform init
                    terraform plan -out=tfplan
                    terraform apply -auto-approve tfplan
                    
                    while ! aws ec2 describe-instances --instance-ids ${EC2_INSTANCE_ID} --query 'Reservations[].Instances[].State.Name' --output text | grep -q 'running'; do
                        echo "Waiting for EC2 instance to start..."
                        sleep 10
                    done
                    
                    EC2_IP=$(aws ec2 describe-instances --instance-ids ${EC2_INSTANCE_ID} --query 'Reservations[].Instances[].PublicIpAddress' --output text)
                    echo "EC2 instance IP: ${EC2_IP}"
                    
                    # Connect via SSH using the PEM file
                    ssh -o StrictHostKeyChecking=no -i ${EC2_SSH_KEY_PATH} ${EC2_USER}@${EC2_IP} "docker run -d -p 80:80 ${FRONTEND_IMAGE}"
                '''
            }
        }
    }
}