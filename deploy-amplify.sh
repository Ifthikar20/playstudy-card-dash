#!/bin/bash

# AWS Amplify Deployment Helper Script
# This script helps you set up and deploy to AWS Amplify

set -e  # Exit on any error

echo "🚀 AWS Amplify Deployment Helper"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Amplify CLI is installed
if ! command -v amplify &> /dev/null; then
    echo -e "${YELLOW}⚠️  Amplify CLI not found${NC}"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g @aws-amplify/cli"
    echo ""
    echo "Then run: amplify configure"
    exit 1
fi

echo -e "${BLUE}What would you like to do?${NC}"
echo "1. Initialize Amplify (first time setup)"
echo "2. Add hosting"
echo "3. Publish/Deploy app"
echo "4. Check status"
echo "5. Open Amplify Console"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}📦 Initializing Amplify...${NC}"
        amplify init
        ;;
    2)
        echo -e "${GREEN}🌐 Adding hosting...${NC}"
        amplify add hosting
        ;;
    3)
        echo -e "${GREEN}🚀 Building and publishing...${NC}"
        echo ""
        echo "This will:"
        echo "  1. Run npm ci (clean install)"
        echo "  2. Build your app (npm run build)"
        echo "  3. Deploy to Amplify"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            amplify publish
        else
            echo "Cancelled."
        fi
        ;;
    4)
        echo -e "${GREEN}📊 Checking status...${NC}"
        amplify status
        ;;
    5)
        echo -e "${GREEN}🌐 Opening Amplify Console...${NC}"
        amplify console
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Done!${NC}"
echo ""
echo "📚 For detailed instructions, see: AMPLIFY_DEPLOYMENT.md"
