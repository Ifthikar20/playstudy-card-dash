#!/bin/bash

# AWS ECS Initial Deployment Script for PlayStudy Backend
# This script sets up the complete ECS deployment infrastructure

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="playstudy"
ECR_REPOSITORY="${PROJECT_NAME}-backend"
ECS_CLUSTER="${PROJECT_NAME}-cluster"
ECS_SERVICE="${PROJECT_NAME}-backend-service"

print_info "Starting ECS deployment setup for PlayStudy Backend..."
echo ""

# Get AWS Account ID
print_step "Retrieving AWS account information..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_info "AWS Account ID: $AWS_ACCOUNT_ID"
print_info "Region: $AWS_REGION"
echo ""

# Get database endpoints
print_step "Retrieving database endpoints..."
DB_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier ${PROJECT_NAME}-db \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region $AWS_REGION)

REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id ${PROJECT_NAME}-redis \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
    --output text \
    --region $AWS_REGION)

print_info "Database Endpoint: $DB_ENDPOINT"
print_info "Redis Endpoint: $REDIS_ENDPOINT"
echo ""

# Database password
DB_PASSWORD_FILE=~/playstudy-db-password.txt
if [ ! -f "$DB_PASSWORD_FILE" ]; then
    print_error "Database password file not found: $DB_PASSWORD_FILE"
    exit 1
fi
DB_PASSWORD=$(cat $DB_PASSWORD_FILE)

# Get security group IDs
print_step "Retrieving security group IDs..."
ECS_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-ecs-tasks" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION)

ALB_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-alb" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION)

print_info "ECS Security Group: $ECS_SG_ID"
print_info "ALB Security Group: $ALB_SG_ID"
echo ""

# Get VPC and Subnets
print_step "Retrieving VPC and subnet information..."
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --query 'Vpcs[0].VpcId' \
    --output text \
    --region $AWS_REGION)

SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[*].SubnetId' \
    --output text \
    --region $AWS_REGION)

SUBNET_ARRAY=($SUBNETS)
print_info "VPC: $VPC_ID"
print_info "Subnets: ${SUBNET_ARRAY[@]}"
echo ""

# Step 1: Create IAM Execution Role
print_step "Creating IAM execution role for ECS tasks..."
EXECUTION_ROLE_NAME="${PROJECT_NAME}-ecs-execution-role"

# Create trust policy
cat > /tmp/ecs-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
    --role-name $EXECUTION_ROLE_NAME \
    --assume-role-policy-document file:///tmp/ecs-trust-policy.json \
    2>/dev/null || print_warning "Execution role already exists"

# Attach required policies
aws iam attach-role-policy \
    --role-name $EXECUTION_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
    2>/dev/null || true

# Create custom policy for Secrets Manager access
cat > /tmp/ecs-secrets-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/*"
      ]
    }
  ]
}
EOF

# Create and attach secrets policy
SECRETS_POLICY_NAME="${PROJECT_NAME}-secrets-access"
aws iam create-policy \
    --policy-name $SECRETS_POLICY_NAME \
    --policy-document file:///tmp/ecs-secrets-policy.json \
    2>/dev/null || print_warning "Secrets policy already exists"

aws iam attach-role-policy \
    --role-name $EXECUTION_ROLE_NAME \
    --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${SECRETS_POLICY_NAME} \
    2>/dev/null || true

EXECUTION_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${EXECUTION_ROLE_NAME}"
print_info "✅ Execution Role: $EXECUTION_ROLE_ARN"
echo ""

# Step 2: Create IAM Task Role
print_step "Creating IAM task role..."
TASK_ROLE_NAME="${PROJECT_NAME}-ecs-task-role"

aws iam create-role \
    --role-name $TASK_ROLE_NAME \
    --assume-role-policy-document file:///tmp/ecs-trust-policy.json \
    2>/dev/null || print_warning "Task role already exists"

TASK_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${TASK_ROLE_NAME}"
print_info "✅ Task Role: $TASK_ROLE_ARN"
echo ""

# Wait for IAM roles to propagate
print_info "Waiting for IAM roles to propagate (10 seconds)..."
sleep 10

# Step 3: Build and Push Docker Image
print_step "Building and pushing Docker image..."

# Check if we're in the deploy directory
if [ ! -d "../backend" ]; then
    print_error "Backend directory not found. Please run this script from the deploy directory."
    exit 1
fi

# Login to ECR
print_info "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build image
print_info "Building Docker image..."
cd ../backend
docker build -t ${ECR_REPOSITORY}:latest .

# Tag for ECR
ECR_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest"
print_info "Tagging image: $ECR_IMAGE"
docker tag ${ECR_REPOSITORY}:latest $ECR_IMAGE

# Push to ECR
print_info "Pushing to ECR..."
docker push $ECR_IMAGE

cd ../deploy
print_info "✅ Docker image pushed to ECR"
echo ""

# Step 4: Create ECS Task Definition
print_step "Creating ECS task definition..."

# Get secret ARNs
SECRET_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/secret-key"
FIELD_ENCRYPTION_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/field-encryption-key"
ANTHROPIC_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/anthropic-api-key"
DEEPSEEK_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/deepseek-api-key"
OPENAI_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/openai-api-key"
GOOGLE_KEY_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/google-cloud-api-key"

# Create task definition JSON
cat > /tmp/task-definition.json <<EOF
{
  "family": "${PROJECT_NAME}-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "${PROJECT_NAME}-backend",
      "image": "${ECR_IMAGE}",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "DATABASE_URL", "value": "postgresql://playstudy_admin:${DB_PASSWORD}@${DB_ENDPOINT}:5432/postgres"},
        {"name": "REDIS_URL", "value": "redis://${REDIS_ENDPOINT}:6379/0"},
        {"name": "ENVIRONMENT", "value": "production"},
        {"name": "CORS_ORIGINS", "value": "*"}
      ],
      "secrets": [
        {"name": "SECRET_KEY", "valueFrom": "${SECRET_KEY_ARN}"},
        {"name": "FIELD_ENCRYPTION_KEY", "valueFrom": "${FIELD_ENCRYPTION_KEY_ARN}"},
        {"name": "ANTHROPIC_API_KEY", "valueFrom": "${ANTHROPIC_KEY_ARN}"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-backend",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Register task definition
TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-definition.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

print_info "✅ Task Definition: $TASK_DEF_ARN"
echo ""

# Step 5: Create Application Load Balancer
print_step "Creating Application Load Balancer..."

# Create ALB
ALB_NAME="${PROJECT_NAME}-alb"
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name $ALB_NAME \
    --subnets ${SUBNET_ARRAY[@]} \
    --security-groups $ALB_SG_ID \
    --scheme internet-facing \
    --type application \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-load-balancers \
        --names $ALB_NAME \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text \
        --region $AWS_REGION)

print_info "✅ ALB Created: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].DNSName' \
    --output text \
    --region $AWS_REGION)

print_info "ALB DNS: $ALB_DNS"
echo ""

# Step 6: Create Target Group
print_step "Creating target group..."

TG_NAME="${PROJECT_NAME}-tg"
TG_ARN=$(aws elbv2 create-target-group \
    --name $TG_NAME \
    --protocol HTTP \
    --port 8000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-enabled \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || \
    aws elbv2 describe-target-groups \
        --names $TG_NAME \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text \
        --region $AWS_REGION)

print_info "✅ Target Group: $TG_ARN"
echo ""

# Step 7: Create ALB Listener
print_step "Creating ALB listener..."

aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN \
    --region $AWS_REGION \
    2>/dev/null || print_warning "Listener may already exist"

print_info "✅ Listener created on port 80"
echo ""

# Step 8: Create ECS Service
print_step "Creating ECS service..."

aws ecs create-service \
    --cluster $ECS_CLUSTER \
    --service-name $ECS_SERVICE \
    --task-definition ${PROJECT_NAME}-backend \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ARRAY[0]},${SUBNET_ARRAY[1]}],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TG_ARN,containerName=${PROJECT_NAME}-backend,containerPort=8000" \
    --region $AWS_REGION \
    2>/dev/null || print_warning "Service may already exist, updating..."

# If service exists, update it
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition ${PROJECT_NAME}-backend \
    --force-new-deployment \
    --region $AWS_REGION \
    2>/dev/null || true

print_info "✅ ECS Service created/updated"
echo ""

# Step 9: Wait for service to stabilize
print_step "Waiting for service to become stable (this may take 3-5 minutes)..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

print_info "✅ Service is stable!"
echo ""

# Display final information
echo "========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Application URL: http://$ALB_DNS"
echo ""
echo "Service Details:"
echo "  Cluster: $ECS_CLUSTER"
echo "  Service: $ECS_SERVICE"
echo "  Task Definition: ${PROJECT_NAME}-backend"
echo ""
echo "Database:"
echo "  RDS Endpoint: $DB_ENDPOINT"
echo "  Redis Endpoint: $REDIS_ENDPOINT"
echo ""
echo "Next Steps:"
echo "  1. Test the health endpoint: curl http://$ALB_DNS/health"
echo "  2. View logs: aws logs tail /ecs/${PROJECT_NAME}-backend --follow"
echo "  3. Check service: aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE"
echo ""
echo "========================================="
