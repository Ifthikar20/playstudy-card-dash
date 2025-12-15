#!/bin/bash

echo "=== TTS Debug Script ==="
echo ""

echo "1. Checking if backend is running..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
    curl -s http://localhost:8000/health | python3 -m json.tool
else
    echo "❌ Backend is NOT running!"
    echo "Start it with: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    exit 1
fi

echo ""
echo "2. Checking backend .env file..."
if [ -f backend/.env ]; then
    echo "✅ backend/.env exists"

    if grep -q "GOOGLE_CLOUD_API_KEY=" backend/.env; then
        KEY_VALUE=$(grep "GOOGLE_CLOUD_API_KEY=" backend/.env | cut -d'=' -f2)
        if [ "$KEY_VALUE" != "your-google-cloud-api-key-here" ] && [ "$KEY_VALUE" != "" ]; then
            echo "✅ GOOGLE_CLOUD_API_KEY is configured (hidden for security)"
        else
            echo "❌ GOOGLE_CLOUD_API_KEY not set or using placeholder"
            echo "Edit backend/.env and add your actual Google Cloud API key"
        fi
    else
        echo "❌ GOOGLE_CLOUD_API_KEY not found in backend/.env"
        echo "Add this line: GOOGLE_CLOUD_API_KEY=your-actual-key"
    fi
else
    echo "❌ backend/.env does not exist!"
    echo "Create it: cp backend/.env.example backend/.env"
    echo "Then add your API keys"
fi

echo ""
echo "3. Testing TTS providers endpoint (without auth)..."
echo "This will fail if you need to be logged in, which is expected."
curl -s http://localhost:8000/api/tts/providers 2>&1 | head -5

echo ""
echo ""
echo "=== Next Steps ==="
echo ""
echo "To test with authentication:"
echo "1. Open your browser to http://localhost:5173"
echo "2. Open DevTools (F12)"
echo "3. Go to Console tab"
echo "4. Run this command:"
echo "   fetch('http://localhost:8000/api/tts/providers', {"
echo "     headers: {'Authorization': 'Bearer ' + localStorage.getItem('access_token')}"
echo "   }).then(r => r.json()).then(console.log)"
echo ""
echo "This will show you what providers the backend is returning."
