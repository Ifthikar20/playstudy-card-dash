#!/bin/bash
# Google Cloud TTS Setup Script
# This script helps you configure Google Cloud TTS API key

echo ""
echo "======================================================================"
echo "  🔊 Google Cloud TTS Setup Script"
echo "======================================================================"
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env not found. Copying from example..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from template"
fi

# Check current key
CURRENT_KEY=$(grep "^GOOGLE_CLOUD_API_KEY=" backend/.env | cut -d'=' -f2)

echo "Current GOOGLE_CLOUD_API_KEY: $CURRENT_KEY"
echo ""

if [ "$CURRENT_KEY" = "your-google-cloud-api-key-here" ]; then
    echo "⚠️  You're using the placeholder key"
elif [ -z "$CURRENT_KEY" ]; then
    echo "⚠️  No key is set"
else
    echo "✅ A key is configured"
    echo "   Length: ${#CURRENT_KEY} characters"
    echo "   Starts with: ${CURRENT_KEY:0:15}..."
fi

echo ""
echo "To get your Google Cloud API key:"
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Create a project or select an existing one"
echo "3. Click 'Create Credentials' → 'API Key'"
echo "4. Copy the key (should start with 'AIza')"
echo "5. Enable Text-to-Speech API:"
echo "   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com"
echo ""

read -p "Enter your Google Cloud API key (or press Enter to skip): " NEW_KEY

if [ ! -z "$NEW_KEY" ]; then
    # Validate key format
    if [[ "$NEW_KEY" == AIza* ]]; then
        # Update the .env file
        sed -i.bak "s/^GOOGLE_CLOUD_API_KEY=.*/GOOGLE_CLOUD_API_KEY=$NEW_KEY/" backend/.env
        echo ""
        echo "✅ Updated backend/.env with your API key"
        echo "   Key: ${NEW_KEY:0:15}...${NEW_KEY: -8}"
        echo ""
        echo "Next steps:"
        echo "1. Restart your backend server"
        echo "2. Run: python troubleshoot_tts.py"
        echo "3. Look for '✅ Status: CONFIGURED' in the logs"
    else
        echo ""
        echo "⚠️  Warning: Key doesn't start with 'AIza'"
        echo "   Are you sure this is a Google Cloud API key?"
        read -p "Update anyway? (y/N): " CONFIRM
        if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
            sed -i.bak "s/^GOOGLE_CLOUD_API_KEY=.*/GOOGLE_CLOUD_API_KEY=$NEW_KEY/" backend/.env
            echo "✅ Updated backend/.env"
        else
            echo "❌ Cancelled"
        fi
    fi
else
    echo ""
    echo "ℹ️  Skipped. You can manually edit backend/.env"
    echo "   Find the line: GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key-here"
    echo "   Replace with: GOOGLE_CLOUD_API_KEY=AIza... (your actual key)"
fi

echo ""
echo "======================================================================"
echo ""
