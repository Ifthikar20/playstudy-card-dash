#!/bin/bash

# AWS Database and Redis Setup Script for PlayStudy
# This script creates RDS PostgreSQL and ElastiCache Redis instances

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

print_info "Starting database and Redis setup for PlayStudy..."
echo ""

# Get VPC and Subnet information
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

# Convert to array
SUBNET_ARRAY=($SUBNETS)
SUBNET_1=${SUBNET_ARRAY[0]}
SUBNET_2=${SUBNET_ARRAY[1]}

print_info "VPC: $VPC_ID"
print_info "Subnet 1: $SUBNET_1"
print_info "Subnet 2: $SUBNET_2"
echo ""

# Get Security Group IDs
print_step "Retrieving security group IDs..."
RDS_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-rds" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION)

REDIS_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-redis" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION)

if [ "$RDS_SG_ID" == "None" ] || [ -z "$RDS_SG_ID" ]; then
    print_error "RDS Security Group not found. Run setup-infrastructure.sh first."
    exit 1
fi

if [ "$REDIS_SG_ID" == "None" ] || [ -z "$REDIS_SG_ID" ]; then
    print_error "Redis Security Group not found. Run setup-infrastructure.sh first."
    exit 1
fi

print_info "RDS Security Group: $RDS_SG_ID"
print_info "Redis Security Group: $REDIS_SG_ID"
echo ""

# Create DB Subnet Group
print_step "Creating DB subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name ${PROJECT_NAME}-db-subnet \
    --db-subnet-group-description "Subnet group for PlayStudy database" \
    --subnet-ids $SUBNET_1 $SUBNET_2 \
    --region $AWS_REGION \
    2>/dev/null || print_warning "DB subnet group already exists"

print_info "✅ DB Subnet group ready"
echo ""

# Generate secure password for database
print_step "Generating secure database password..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo ""
echo "========================================="
echo "⚠️  DATABASE PASSWORD - SAVE THIS!"
echo "========================================="
echo "Password: $DB_PASSWORD"
echo "========================================="
echo ""

# Save password to file
PASSWORD_FILE=~/playstudy-db-password.txt
echo $DB_PASSWORD > $PASSWORD_FILE
print_info "Password saved to: $PASSWORD_FILE"
echo ""

# Create RDS PostgreSQL instance
print_step "Creating RDS PostgreSQL database (this takes 10-15 minutes)..."
aws rds create-db-instance \
    --db-instance-identifier ${PROJECT_NAME}-db \
    --db-instance-class db.t4g.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username ${PROJECT_NAME}_admin \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage 20 \
    --storage-type gp3 \
    --storage-encrypted \
    --vpc-security-group-ids $RDS_SG_ID \
    --db-subnet-group-name ${PROJECT_NAME}-db-subnet \
    --backup-retention-period 7 \
    --no-publicly-accessible \
    --enable-cloudwatch-logs-exports '["postgresql"]' \
    --region $AWS_REGION \
    2>/dev/null || print_warning "RDS instance may already exist"

print_info "✅ RDS creation initiated"
echo ""

# Create Redis subnet group
print_step "Creating Redis subnet group..."
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet \
    --cache-subnet-group-description "Subnet group for PlayStudy Redis" \
    --subnet-ids $SUBNET_1 $SUBNET_2 \
    --region $AWS_REGION \
    2>/dev/null || print_warning "Redis subnet group already exists"

print_info "✅ Redis subnet group ready"
echo ""

# Create Redis cluster
print_step "Creating ElastiCache Redis cluster (this takes 5-10 minutes)..."
aws elasticache create-cache-cluster \
    --cache-cluster-id ${PROJECT_NAME}-redis \
    --cache-node-type cache.t4g.micro \
    --engine redis \
    --engine-version 7.0 \
    --num-cache-nodes 1 \
    --security-group-ids $REDIS_SG_ID \
    --cache-subnet-group-name ${PROJECT_NAME}-redis-subnet \
    --region $AWS_REGION \
    2>/dev/null || print_warning "Redis cluster may already exist"

print_info "✅ Redis creation initiated"
echo ""

# Generate encryption keys
print_step "Generating encryption keys for Secrets Manager..."

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    # Check if cryptography is installed
    if python3 -c "import cryptography" 2>/dev/null; then
        FIELD_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    else
        print_warning "cryptography package not found, using openssl for encryption key"
        FIELD_ENCRYPTION_KEY=$(openssl rand -base64 32)
    fi
else
    print_warning "Python 3 not found, using openssl for key generation"
    SECRET_KEY=$(openssl rand -base64 32)
    FIELD_ENCRYPTION_KEY=$(openssl rand -base64 32)
fi

# Store in AWS Secrets Manager
print_step "Storing encryption keys in AWS Secrets Manager..."

aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/secret-key \
    --secret-string "$SECRET_KEY" \
    --region $AWS_REGION \
    2>/dev/null || {
        print_warning "Secret already exists, updating..."
        aws secretsmanager put-secret-value \
            --secret-id ${PROJECT_NAME}/secret-key \
            --secret-string "$SECRET_KEY" \
            --region $AWS_REGION
    }

aws secretsmanager create-secret \
    --name ${PROJECT_NAME}/field-encryption-key \
    --secret-string "$FIELD_ENCRYPTION_KEY" \
    --region $AWS_REGION \
    2>/dev/null || {
        print_warning "Secret already exists, updating..."
        aws secretsmanager put-secret-value \
            --secret-id ${PROJECT_NAME}/field-encryption-key \
            --secret-string "$FIELD_ENCRYPTION_KEY" \
            --region $AWS_REGION
    }

print_info "✅ Encryption keys stored in AWS Secrets Manager"
echo ""

# Prompt for API keys
print_step "Setting up API keys..."
echo ""
echo "Please provide your API keys (press Enter to skip optional ones):"
echo ""

# Anthropic API Key (required)
read -p "Enter your Anthropic API Key (required): " ANTHROPIC_KEY
if [ ! -z "$ANTHROPIC_KEY" ]; then
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/anthropic-api-key \
        --secret-string "$ANTHROPIC_KEY" \
        --region $AWS_REGION \
        2>/dev/null || {
            aws secretsmanager put-secret-value \
                --secret-id ${PROJECT_NAME}/anthropic-api-key \
                --secret-string "$ANTHROPIC_KEY" \
                --region $AWS_REGION
        }
    print_info "✅ Anthropic API key stored"
else
    print_warning "Anthropic API key is required for AI features!"
fi

# DeepSeek API Key (optional)
read -p "Enter your DeepSeek API Key (optional - press Enter to skip): " DEEPSEEK_KEY
if [ ! -z "$DEEPSEEK_KEY" ]; then
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/deepseek-api-key \
        --secret-string "$DEEPSEEK_KEY" \
        --region $AWS_REGION \
        2>/dev/null || {
            aws secretsmanager put-secret-value \
                --secret-id ${PROJECT_NAME}/deepseek-api-key \
                --secret-string "$DEEPSEEK_KEY" \
                --region $AWS_REGION
        }
    print_info "✅ DeepSeek API key stored"
fi

# OpenAI API Key (optional)
read -p "Enter your OpenAI API Key (optional - for TTS, press Enter to skip): " OPENAI_KEY
if [ ! -z "$OPENAI_KEY" ]; then
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/openai-api-key \
        --secret-string "$OPENAI_KEY" \
        --region $AWS_REGION \
        2>/dev/null || {
            aws secretsmanager put-secret-value \
                --secret-id ${PROJECT_NAME}/openai-api-key \
                --secret-string "$OPENAI_KEY" \
                --region $AWS_REGION
        }
    print_info "✅ OpenAI API key stored"
fi

# Google Cloud API Key (optional)
read -p "Enter your Google Cloud API Key (optional - for TTS, press Enter to skip): " GOOGLE_KEY
if [ ! -z "$GOOGLE_KEY" ]; then
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/google-cloud-api-key \
        --secret-string "$GOOGLE_KEY" \
        --region $AWS_REGION \
        2>/dev/null || {
            aws secretsmanager put-secret-value \
                --secret-id ${PROJECT_NAME}/google-cloud-api-key \
                --secret-string "$GOOGLE_KEY" \
                --region $AWS_REGION
        }
    print_info "✅ Google Cloud API key stored"
fi

# reCAPTCHA Secret Key (optional)
read -p "Enter your reCAPTCHA Secret Key (optional - press Enter to skip): " RECAPTCHA_KEY
if [ ! -z "$RECAPTCHA_KEY" ]; then
    aws secretsmanager create-secret \
        --name ${PROJECT_NAME}/recaptcha-secret-key \
        --secret-string "$RECAPTCHA_KEY" \
        --region $AWS_REGION \
        2>/dev/null || {
            aws secretsmanager put-secret-value \
                --secret-id ${PROJECT_NAME}/recaptcha-secret-key \
                --secret-string "$RECAPTCHA_KEY" \
                --region $AWS_REGION
        }
    print_info "✅ reCAPTCHA secret key stored"
fi

echo ""
print_info "✅ API keys stored securely in AWS Secrets Manager"
echo ""

# Status checking function
check_status() {
    echo ""
    print_step "Checking infrastructure status..."

    RDS_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier ${PROJECT_NAME}-db \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "creating")

    REDIS_STATUS=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id ${PROJECT_NAME}-redis \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "creating")

    echo "RDS Database: $RDS_STATUS"
    echo "Redis Cache: $REDIS_STATUS"
    echo ""

    if [ "$RDS_STATUS" = "available" ] && [ "$REDIS_STATUS" = "available" ]; then
        print_info "✅ Both RDS and Redis are READY!"

        # Get endpoints
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

        echo ""
        echo "========================================="
        echo "DATABASE CONNECTION INFO"
        echo "========================================="
        echo "RDS Endpoint: $DB_ENDPOINT"
        echo "Database Name: ${PROJECT_NAME}_db"
        echo "Username: ${PROJECT_NAME}_admin"
        echo "Password: (saved in $PASSWORD_FILE)"
        echo ""
        echo "Redis Endpoint: $REDIS_ENDPOINT"
        echo "========================================="
        echo ""

        # Save endpoints to file
        echo "DB_ENDPOINT=$DB_ENDPOINT" > ~/playstudy-endpoints.txt
        echo "REDIS_ENDPOINT=$REDIS_ENDPOINT" >> ~/playstudy-endpoints.txt
        print_info "Endpoints saved to: ~/playstudy-endpoints.txt"

        return 0
    else
        print_warning "⏳ Still creating... (this takes 10-15 minutes total)"
        echo ""
        echo "You can check status again by running:"
        echo "  aws rds describe-db-instances --db-instance-identifier ${PROJECT_NAME}-db --region $AWS_REGION"
        echo "  aws elasticache describe-cache-clusters --cache-cluster-id ${PROJECT_NAME}-redis --region $AWS_REGION"
        return 1
    fi
}

# Initial status check
print_step "⏳ Waiting for RDS and Redis to become available..."
echo "   This will take 10-15 minutes. Checking current status..."
check_status

echo ""
print_info "Setup script completed!"
echo ""
print_info "Next steps:"
echo "  1. Wait for RDS and Redis to be available (10-15 minutes)"
echo "  2. Run this script again or check manually to get endpoints"
echo "  3. Proceed with ECS deployment using deploy.sh"
