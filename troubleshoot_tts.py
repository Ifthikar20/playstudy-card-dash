#!/usr/bin/env python3
"""
Google Cloud TTS Troubleshooting Script

This script diagnoses Google Cloud TTS configuration issues.
Run this from the project root directory.
"""

import os
import sys
from pathlib import Path

def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def check_env_file():
    """Check if .env file exists and contains Google Cloud API key."""
    print_header("🔍 CHECKING .env FILE")

    env_path = Path("backend/.env")

    if not env_path.exists():
        print("❌ backend/.env file NOT FOUND")
        print("   Action: Copy backend/.env.example to backend/.env")
        return False

    print("✅ backend/.env file exists")

    # Read and check API key
    with open(env_path, 'r') as f:
        content = f.read()

    if "GOOGLE_CLOUD_API_KEY" not in content:
        print("❌ GOOGLE_CLOUD_API_KEY not found in .env")
        print("   Action: Add GOOGLE_CLOUD_API_KEY to backend/.env")
        return False

    print("✅ GOOGLE_CLOUD_API_KEY variable exists")

    # Extract the key value
    for line in content.split('\n'):
        if line.startswith('GOOGLE_CLOUD_API_KEY='):
            key_value = line.split('=', 1)[1].strip()

            if not key_value:
                print("❌ GOOGLE_CLOUD_API_KEY is empty")
                print("   Action: Set your actual Google Cloud API key")
                return False

            if key_value == "your-google-cloud-api-key-here":
                print("❌ GOOGLE_CLOUD_API_KEY is still the placeholder value")
                print("   Current value: your-google-cloud-api-key-here")
                print("   Action: Replace with your actual Google Cloud API key")
                return False

            # Check key format (Google Cloud keys usually start with AIza)
            if not key_value.startswith("AIza"):
                print(f"⚠️  GOOGLE_CLOUD_API_KEY doesn't look like a Google Cloud key")
                print(f"   Current value starts with: {key_value[:10]}...")
                print(f"   Expected format: AIza...")
                print(f"   Key length: {len(key_value)} characters")
                return False

            print(f"✅ GOOGLE_CLOUD_API_KEY is configured")
            print(f"   Key starts with: {key_value[:15]}...")
            print(f"   Key ends with: ...{key_value[-8:]}")
            print(f"   Key length: {len(key_value)} characters")
            return True

    return False

def check_deepseek_key():
    """Check DeepSeek API key."""
    print_header("🔍 CHECKING DEEPSEEK API KEY")

    env_path = Path("backend/.env")

    with open(env_path, 'r') as f:
        content = f.read()

    for line in content.split('\n'):
        if line.startswith('DEEPSEEK_API_KEY='):
            key_value = line.split('=', 1)[1].strip()

            if key_value == "your-deepseek-api-key-here":
                print("❌ DEEPSEEK_API_KEY is placeholder")
                return False

            print(f"✅ DEEPSEEK_API_KEY is configured")
            print(f"   Key length: {len(key_value)} characters")
            return True

    return False

def test_import_settings():
    """Test importing settings from backend."""
    print_header("🔍 TESTING BACKEND CONFIGURATION")

    # Add backend to path
    backend_path = Path("backend")
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))

    try:
        from app.config import settings
        print("✅ Successfully imported backend settings")

        # Check Google Cloud API Key
        if settings.GOOGLE_CLOUD_API_KEY:
            is_placeholder = settings.GOOGLE_CLOUD_API_KEY == "your-google-cloud-api-key-here"

            if is_placeholder:
                print("❌ Backend loaded PLACEHOLDER Google Cloud API key")
                return False

            print(f"✅ Backend loaded Google Cloud API key")
            print(f"   Length: {len(settings.GOOGLE_CLOUD_API_KEY)}")
            print(f"   First 15 chars: {settings.GOOGLE_CLOUD_API_KEY[:15]}...")
            return True
        else:
            print("❌ Backend settings.GOOGLE_CLOUD_API_KEY is None or empty")
            return False

    except Exception as e:
        print(f"❌ Failed to import backend settings: {e}")
        print("   This is OK if backend dependencies aren't installed")
        return None

def test_provider_initialization():
    """Test TTS provider initialization."""
    print_header("🔍 TESTING TTS PROVIDER")

    backend_path = Path("backend")
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))

    try:
        from app.services.tts_providers import GoogleCloudTTSProvider

        print("Creating GoogleCloudTTSProvider instance...")
        provider = GoogleCloudTTSProvider()

        is_configured = provider.is_configured()

        if is_configured:
            print("✅ GoogleCloudTTSProvider is CONFIGURED")
            return True
        else:
            print("❌ GoogleCloudTTSProvider is NOT configured")
            return False

    except Exception as e:
        print(f"❌ Failed to test provider: {e}")
        return None

def check_frontend_config():
    """Check frontend configuration."""
    print_header("🔍 CHECKING FRONTEND CONFIGURATION")

    frontend_env = Path(".env")
    if frontend_env.exists():
        print("✅ Frontend .env file exists")
        with open(frontend_env, 'r') as f:
            content = f.read()

        if "VITE_API_URL" in content:
            for line in content.split('\n'):
                if line.startswith('VITE_API_URL='):
                    api_url = line.split('=', 1)[1].strip()
                    print(f"✅ VITE_API_URL: {api_url}")
        else:
            print("⚠️  VITE_API_URL not found in frontend .env")
    else:
        print("⚠️  Frontend .env file not found")

def provide_fix_instructions():
    """Provide instructions to fix the issue."""
    print_header("🔧 HOW TO FIX")

    print("""
To configure Google Cloud TTS:

1. Get your Google Cloud API Key:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create or select a project
   - Click "Create Credentials" → "API Key"
   - Enable Text-to-Speech API: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
   - Copy the API key (should start with 'AIza')

2. Update backend/.env:
   - Open backend/.env in a text editor
   - Find the line: GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key-here
   - Replace with: GOOGLE_CLOUD_API_KEY=AIza... (your actual key)
   - Save the file

3. Restart your backend server:
   - Stop the current backend (Ctrl+C)
   - Restart: python -m uvicorn app.main:app --reload

4. Check the logs:
   - You should see: "✅ Status: CONFIGURED"
   - Key should start with "AIza"

5. Test in frontend:
   - Go to Mentor Mode
   - Click play
   - Check browser console for provider being used
""")

def main():
    """Run all diagnostics."""
    print("\n" + "🔊" * 35)
    print("   GOOGLE CLOUD TTS TROUBLESHOOTING SCRIPT")
    print("🔊" * 35)

    results = {}

    # Run checks
    results['env_file'] = check_env_file()
    results['deepseek'] = check_deepseek_key()
    results['backend_config'] = test_import_settings()
    results['provider'] = test_provider_initialization()
    check_frontend_config()

    # Summary
    print_header("📊 SUMMARY")

    all_passed = all(v == True for v in results.values() if v is not None)

    if all_passed:
        print("✅ ALL CHECKS PASSED!")
        print("   Google Cloud TTS should be working.")
        print("   If you're still seeing browser TTS, restart your backend server.")
    else:
        print("❌ SOME CHECKS FAILED")
        print("\nFailed checks:")
        for check, result in results.items():
            if result == False:
                print(f"  ❌ {check}")

        provide_fix_instructions()

    print("\n" + "=" * 70 + "\n")

if __name__ == "__main__":
    main()
