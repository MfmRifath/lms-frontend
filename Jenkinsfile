pipeline {
    agent any
    
    parameters {
        booleanParam(name: 'CLEANUP_OLD_RESOURCES', defaultValue: false, description: 'Clean up resources from previous runs')
        string(name: 'NEW_USER', defaultValue: 'appuser', description: 'Username for the new system user')
        password(name: 'NEW_USER_PASSWORD', defaultValue: '', description: 'Password for the new system user (leave empty for SSH-only access)')
        booleanParam(name: 'SUDO_ACCESS', defaultValue: true, description: 'Grant sudo access to the new user')
    }
    
    environment {
        DOCKER_HUB_CREDS = credentials('docker-registry-credentials')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
        FRONTEND_IMAGE = 'rifathmfm/lms-frontend:latest'
        PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${env.PATH}"
        TF_VAR_public_key_path = "${env.WORKSPACE}/ssh_key.pub"
        EC2_USER = "ubuntu"
        NEW_USER_HOME = "/home/${params.NEW_USER}"
    }
    
    stages {
        stage('Cleanup Old Resources') {
            when {
                expression { return params.CLEANUP_OLD_RESOURCES == true }
            }
            steps {
                sh '''
                    cd terraform || mkdir -p terraform && cd terraform
                    
                    # List all EC2 instances with our deployment tags
                    echo "Listing all EC2 instances from previous deployments..."
                    aws ec2 describe-instances \
                      --filters "Name=tag-key,Values=Name" "Name=tag-value,Values=lms-frontend-instance-*" \
                      --query "Reservations[*].Instances[*].{InstanceId:InstanceId,Name:Tags[?Key=='Name']|[0].Value,State:State.Name}" \
                      --output table || echo "Failed to list instances, continuing..."
                    
                    # List security groups
                    echo "Listing security groups from previous deployments..."
                    aws ec2 describe-security-groups \
                      --filters "Name=group-name,Values=lms-frontend-sg-*" \
                      --query "SecurityGroups[*].{GroupId:GroupId,GroupName:GroupName}" \
                      --output table || echo "Failed to list security groups, continuing..."
                    
                    # List key pairs
                    echo "Listing key pairs from previous deployments..."
                    aws ec2 describe-key-pairs \
                      --filters "Name=key-name,Values=lms-key-pair-*" \
                      --query "KeyPairs[*].{KeyName:KeyName}" \
                      --output table || echo "Failed to list key pairs, continuing..."
                    
                    echo "WARNING: This is a placeholder for cleanup logic."
                    echo "In a production environment, implement proper cleanup logic here."
                    echo "Manual cleanup may be required for now."
                '''
            }
        }
        
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
                    
                    # Check Ansible version
                    ansible --version || echo "Ansible not installed"
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
                    echo "Generated public key:"
                    cat ssh_key.pub
                    
                    # Generate a second SSH key pair for the new user
                    rm -f new_user_key new_user_key.pub
                    ssh-keygen -t rsa -b 2048 -f new_user_key -N "" -q
                    chmod 400 new_user_key
                    echo "Generated new user public key:"
                    cat new_user_key.pub
                    
                    # Create Terraform directory
                    mkdir -p terraform
                    
                    # Create main.tf with unique resource names
                    cat > terraform/main.tf <<'EOF'
provider "aws" {
  region = var.aws_region
}

# Use a timestamp to ensure unique resource names
locals {
  timestamp = formatdate("YYYYMMDD-hhmmss", timestamp())
  name_suffix = "${var.resource_name_prefix}-${local.timestamp}"
}

resource "aws_security_group" "lms_frontend_sg" {
  name        = "lms-frontend-sg-${local.name_suffix}"
  description = "Security group for LMS Frontend (${local.timestamp})"

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
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Access for application on port 3000"
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
    Name = "lms-frontend-sg-${local.name_suffix}"
    CreatedBy = "jenkins"
    Timestamp = local.timestamp
  }
}

resource "aws_key_pair" "lms_key_pair" {
  key_name   = "lms-key-pair-${local.name_suffix}"
  public_key = file(var.public_key_path)
  
  tags = {
    CreatedBy = "jenkins"
    Timestamp = local.timestamp
  }
}

resource "aws_instance" "lms_frontend" {
  ami                    = var.instance_ami
  instance_type          = var.instance_type
  key_name               = aws_key_pair.lms_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.lms_frontend_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              # Update and install Docker
              apt-get update -y
              apt-get install docker.io -y
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ubuntu
              
              # Improve SSH security setup
              mkdir -p /home/ubuntu/.ssh
              chmod 700 /home/ubuntu/.ssh
              cp /home/ubuntu/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys.bak || echo "No authorized_keys to backup"
              
              # Ensure the authorized_keys file has proper permissions
              chmod 600 /home/ubuntu/.ssh/authorized_keys
              chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys
              chown -R ubuntu:ubuntu /home/ubuntu/.ssh
              
              # Make sure SSH is running and properly configured
              systemctl restart ssh
              
              # Log initialization
              echo "$(date): Instance initialization complete" > /var/log/user-data.log
              
              # Signal that the instance is ready by creating a file
              touch /tmp/instance-ready
              EOF

  tags = {
    Name = "lms-frontend-instance-${local.name_suffix}"
    CreatedBy = "jenkins"
    Timestamp = local.timestamp
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
  description = "AMI ID for the EC2 instance (Ubuntu)"
  type        = string
  default     = "ami-0230bd60aa48260c6" # Ubuntu 22.04 LTS in us-east-1
}

variable "public_key_path" {
  description = "Path to the public key for SSH access"
  type        = string
}

variable "resource_name_prefix" {
  description = "Prefix to add to resource names for uniqueness"
  type        = string
  default     = "deploy"
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

output "security_group_id" {
  description = "ID of the created security group"
  value       = aws_security_group.lms_frontend_sg.id
}

output "key_pair_name" {
  description = "Name of the created key pair"
  value       = aws_key_pair.lms_key_pair.key_name
}
EOF

                    # Make sure ansible directory exists and is clean
                    rm -rf ansible
                    mkdir -p ansible
                    
                    # Create Ansible inventory template file (will be populated later)
                    echo '[frontend]' > ansible/inventory
                    echo '# Will be populated with actual EC2 DNS during deployment' >> ansible/inventory

                    # Create Ansible playbook for Docker installation (updated for Ubuntu)
                    cat > ansible/docker.yml <<'EOF'
---
- name: Install Docker on EC2 instance
  hosts: frontend
  become: yes
  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
      
    - name: Install required packages
      apt:
        name:
          - apt-transport-https
          - ca-certificates
          - curl
          - software-properties-common
        state: present
      
    - name: Add Docker GPG key
      apt_key:
        url: https://download.docker.com/linux/ubuntu/gpg
        state: present
      
    - name: Add Docker repository
      apt_repository:
        repo: deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable
        state: present
      
    - name: Install Docker CE
      apt:
        name: docker-ce
        state: present
      
    - name: Start Docker service
      service:
        name: docker
        state: started
        enabled: yes
      
    - name: Add ubuntu user to docker group
      user:
        name: ubuntu
        groups: docker
        append: yes
EOF

                    # Create Ansible playbook for user creation
                    cat > ansible/create_user.yml <<'EOF'
---
- name: Create new user with proper permissions
  hosts: frontend
  become: yes
  vars:
    new_username: "{{ lookup('env', 'NEW_USER') }}"
    new_user_password: "{{ lookup('env', 'NEW_USER_PASSWORD') }}"
    sudo_access: "{{ lookup('env', 'SUDO_ACCESS') | bool }}"
    new_user_home: "{{ lookup('env', 'NEW_USER_HOME') }}"
  
  tasks:
    - name: Create the new user
      user:
        name: "{{ new_username }}"
        state: present
        shell: /bin/bash
        createhome: yes
        home: "{{ new_user_home }}"
        generate_ssh_key: no
        
    - name: Set password for the new user (if provided)
      user:
        name: "{{ new_username }}"
        password: "{{ new_user_password | password_hash('sha512') }}"
      when: new_user_password != ""
    
    - name: Create .ssh directory for the new user
      file:
        path: "{{ new_user_home }}/.ssh"
        state: directory
        mode: '0700'
        owner: "{{ new_username }}"
        group: "{{ new_username }}"
    
    - name: Create authorized_keys file for the new user
      copy:
        src: ../new_user_key.pub
        dest: "{{ new_user_home }}/.ssh/authorized_keys"
        mode: '0600'
        owner: "{{ new_username }}"
        group: "{{ new_username }}"
        remote_src: no
    
    - name: Add to sudo group if requested
      user:
        name: "{{ new_username }}"
        groups: sudo
        append: yes
      when: sudo_access
    
    - name: Create sudoers file for the new user
      copy:
        content: "{{ new_username }} ALL=(ALL) NOPASSWD:ALL"
        dest: "/etc/sudoers.d/{{ new_username }}"
        mode: '0440'
        owner: root
        group: root
        validate: 'visudo -cf %s'
      when: sudo_access
    
    - name: Add new user to docker group
      user:
        name: "{{ new_username }}"
        groups: docker
        append: yes
        
    - name: Verify user creation
      command: id "{{ new_username }}"
      register: id_output
      
    - name: Display user information
      debug:
        msg: "{{ id_output.stdout }}"
EOF

                    # Create Ansible playbook for application deployment
                    cat > ansible/deploy.yml <<'EOF'
---
- name: Deploy LMS frontend application
  hosts: frontend
  become: yes
  vars:
    docker_image: rifathmfm/lms-frontend:latest
  
  tasks:
    - name: Pull Docker image
      docker_image:
        name: "{{ docker_image }}"
        source: pull
      
    - name: Stop and remove existing container if it exists
      docker_container:
        name: lms-frontend
        state: absent
      ignore_errors: yes
      
    - name: Run frontend container
      docker_container:
        name: lms-frontend
        image: "{{ docker_image }}"
        ports:
          - "80:80"
        restart_policy: always
        state: started
        
    - name: Check if application is running
      uri:
        url: http://localhost
        return_content: yes
      register: app_status
      ignore_errors: yes
      
    - name: Report application status
      debug:
        msg: "Application is {{ 'running' if app_status.status == 200 else 'not running' }}"
EOF

                    # Create deployment script for manual deployment option
                    cat > deploy-script.sh <<'EOF'
#!/bin/bash
# Script to deploy the LMS frontend to EC2 instance

# Load configuration
EC2_DNS=$1
SSH_KEY_PATH=${2:-ssh_key}
DOCKER_IMAGE=${3:-rifathmfm/lms-frontend:latest}

# Check if EC2_DNS was provided
if [ -z "$EC2_DNS" ]; then
  echo "Error: EC2 DNS name required"
  echo "Usage: $0 <ec2-dns-name> [ssh-key-path] [docker-image]"
  exit 1
fi

echo "Deploying to EC2 instance: $EC2_DNS"
echo "Using SSH key: $SSH_KEY_PATH"
echo "Using Docker image: $DOCKER_IMAGE"

# Check if private key exists and has correct permissions
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Error: SSH key not found at $SSH_KEY_PATH"
  exit 1
fi

chmod 400 "$SSH_KEY_PATH"

# Deploy application
echo "Installing Docker on EC2 instance..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@"$EC2_DNS" '
  sudo apt-get update -y
  sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
  sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
  sudo apt-get update -y
  sudo apt-get install -y docker-ce
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker ubuntu
'

echo "Deploying application container..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no ubuntu@"$EC2_DNS" "
  sudo docker pull $DOCKER_IMAGE
  sudo docker rm -f lms-frontend 2>/dev/null || true
  sudo docker run -d --name lms-frontend -p 80:80 $DOCKER_IMAGE
  echo 'Deployment complete. Application running at: http://$EC2_DNS'
"

echo "Deployment completed successfully!"
echo "Application available at: http://$EC2_DNS"
EOF
                    chmod +x deploy-script.sh
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
                    
                    # Set a unique build identifier using Jenkins BUILD_NUMBER
                    UNIQUE_PREFIX="deploy-${BUILD_NUMBER}"
                    echo "Using unique resource prefix: ${UNIQUE_PREFIX}"
                    
                    # Initialize Terraform
                    terraform init
                    
                    # Plan the deployment with unique name prefix
                    terraform plan -out=tfplan \
                        -var "public_key_path=${TF_VAR_public_key_path}" \
                        -var "resource_name_prefix=${UNIQUE_PREFIX}"
                    
                    # Apply the Terraform configuration
                    terraform apply -auto-approve tfplan
                    
                    # Extract the EC2 instance information for later use
                    echo "$(terraform output -json)" > ../terraform_output.json
                    
                    # Extract the public DNS and instance ID for SSH access
                    EC2_DNS=$(terraform output -raw ec2_instance_dns)
                    EC2_IP=$(terraform output -raw ec2_instance_ip)
                    EC2_INSTANCE_ID=$(terraform output -raw ec2_instance_id)
                    SG_ID=$(terraform output -raw security_group_id)
                    KEY_NAME=$(terraform output -raw key_pair_name)
                    
                    echo "EC2_DNS=${EC2_DNS}" > ../ec2_info.properties
                    echo "EC2_IP=${EC2_IP}" >> ../ec2_info.properties
                    echo "EC2_INSTANCE_ID=${EC2_INSTANCE_ID}" >> ../ec2_info.properties
                    echo "SECURITY_GROUP_ID=${SG_ID}" >> ../ec2_info.properties
                    echo "KEY_PAIR_NAME=${KEY_NAME}" >> ../ec2_info.properties
                    echo "RESOURCE_PREFIX=${UNIQUE_PREFIX}" >> ../ec2_info.properties
                    
                    echo "EC2 Instance provisioned at: ${EC2_DNS}"
                    echo "EC2 Instance ID: ${EC2_INSTANCE_ID}"
                    
                    # Wait for instance to initialize before proceeding
                    echo "Waiting for instance initialization (3 minutes)..."
                    sleep 180
                '''
            }
        }
        
        stage('Deploy with Ansible') {
            steps {
                sh '''
                    # Load EC2 info from properties file
                    source ec2_info.properties
                    
                    # Ensure SSH key has correct permissions
                    chmod 400 ssh_key
                    chmod 400 new_user_key
                    ls -la ssh_key new_user_key
                    
                    # Create a new inventory file with the correct EC2 DNS and better SSH params
                    echo "[frontend]" > ansible/inventory
                    echo "ec2_host ansible_host=${EC2_DNS} ansible_user=${EC2_USER} ansible_ssh_private_key_file=$(pwd)/ssh_key ansible_ssh_common_args='-o StrictHostKeyChecking=no -o ConnectionAttempts=10 -o ConnectTimeout=30'" >> ansible/inventory
                    
                    # Print the inventory for debugging
                    echo "Ansible inventory contents:"
                    cat ansible/inventory
                    
                    # Wait with longer timeouts and more patience
                    echo "Waiting for EC2 instance to be ready for SSH..."
                    MAX_ATTEMPTS=30
                    ATTEMPT_DELAY=20
                    for i in $(seq 1 $MAX_ATTEMPTS); do
                        if ssh -i ssh_key -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ConnectionAttempts=3 ${EC2_USER}@${EC2_DNS} "echo Instance is ready"; then
                            echo "SSH connection successful on attempt $i"
                            break
                        fi
                        
                        if [ $i -eq $MAX_ATTEMPTS ]; then
                            echo "Failed to establish SSH connection after $MAX_ATTEMPTS attempts"
                            exit 1
                        fi
                        
                        echo "Attempt $i of $MAX_ATTEMPTS: Waiting for SSH to be available..."
                        sleep $ATTEMPT_DELAY
                    done
                    
                    # Run Ansible with better SSH settings
                    echo "Running Ansible playbook with verbose output..."
                    ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -vvv -i ansible/inventory ansible/docker.yml
                    
                    # Deploy the application with Ansible
                    echo "Deploying application with Ansible..."
                    ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -i ansible/inventory ansible/deploy.yml
                    
                    echo "Deployment completed successfully!"
                    echo "Application is available at: http://${EC2_DNS}"
                '''
            }
        }
        
        stage('Create New User') {
            steps {
                sh '''
                    # Load EC2 info from properties file
                    source ec2_info.properties
                    
                    echo "Creating new user: ${NEW_USER} with sudo access: ${SUDO_ACCESS}"
                    
                    # Export variables for Ansible
                    export NEW_USER_PASSWORD=${NEW_USER_PASSWORD}
                    export SUDO_ACCESS=${SUDO_ACCESS}
                    
                    # Create the new user with Ansible
                    ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -vvv -i ansible/inventory ansible/create_user.yml
                    
                    # Test SSH access with the new user
                    echo "Testing SSH access for the new user..."
                    if ssh -i new_user_key -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ConnectionAttempts=3 ${NEW_USER}@${EC2_DNS} "echo 'New user SSH connection successful'; id"; then
                        echo "✅ New user SSH access verified successfully!"
                    else
                        echo "⚠️ Could not verify new user SSH access, but continuing deployment..."
                    fi
                    
                    # Save new user access information
                    echo "NEW_USER=${NEW_USER}" >> ec2_info.properties
                    echo "NEW_USER_KEY_PATH=$(pwd)/new_user_key" >> ec2_info.properties
                    
                    # Create a useful info file for the new user
                    cat > new_user_access_info.txt <<EOF
=================================
NEW USER ACCESS INFORMATION
=================================
Server: ${EC2_DNS}
Username: ${NEW_USER}
Private Key: new_user_key (in Jenkins workspace)
Sudo Access: ${SUDO_ACCESS}

To connect:
ssh -i new_user_key ${NEW_USER}@${EC2_DNS}

Application URL: http://${EC2_DNS}
=================================
EOF
                '''
                
                // Archive the new user credentials separately for security
                archiveArtifacts artifacts: 'new_user_key, new_user_key.pub, new_user_access_info.txt', fingerprint: true, onlyIfSuccessful: true
            }
        }
        
        stage('Verify Deployment') {
            steps {
                sh '''
                    # Load EC2 info from properties file
                    source ec2_info.properties
                    
                    # Verify application is running
                    echo "Verifying application deployment..."
                    if curl -s -o /dev/null -w "%{http_code}" http://${EC2_DNS}/ | grep -q "200"; then
                        echo "✅ Application is running successfully!"
                    else
                        echo "⚠️ Could not verify application is running properly."
                    fi
                    
                    # Check Docker container status
                    echo "Checking Docker container status..."
                    ssh -i ssh_key -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_DNS} "sudo docker ps -a"
                    
                    # Check as new user if applicable
                    if [ -f new_user_key ]; then
                        echo "Verifying new user permissions..."
                        ssh -i new_user_key -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${NEW_USER}@${EC2_DNS} "
                            echo 'Checking sudo access:' && sudo echo 'Sudo access: SUCCESSFUL' || echo 'Sudo access: FAILED';
                            echo 'Checking Docker access:' && docker ps -a && echo 'Docker access: SUCCESSFUL' || echo 'Docker access: FAILED';
                        " || echo "Could not verify new user permissions"
                    fi
                '''
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'ssh_key, ssh_key.pub, ec2_info.properties, terraform_output.json, deploy-script.sh, ansible/*', allowEmptyArchive: true
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
                Resource Prefix: ${RESOURCE_PREFIX:-Not Available}
                
                New User: ${NEW_USER:-Not Created}
                New User SSH Key: new_user_key
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