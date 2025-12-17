#!/usr/bin/env python3
"""
End-to-End Google Cloud TTS Testing Script

This script tests the complete TTS pipeline from frontend to Google Cloud API.
"""

import requests
import json
import sys
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000/api"
ACCESS_TOKEN = None  # Will be set via command line

def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_step(step_num, title):
    """Print a step header."""
    print(f"\n{'─' * 70}")
    print(f"STEP {step_num}: {title}")
    print('─' * 70)

def test_providers_endpoint():
    """Test the /api/tts/providers endpoint."""
    print_step(1, "Testing TTS Providers Endpoint")

    try:
        headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        print(f"📡 GET {API_BASE_URL}/tts/providers")
        print(f"🔑 Using token: {ACCESS_TOKEN[:50]}...")

        response = requests.get(
            f"{API_BASE_URL}/tts/providers",
            headers=headers,
            timeout=10
        )

        print(f"\n📊 Response Status: {response.status_code}")

        if response.status_code == 200:
            providers = response.json()
            print(f"✅ Success! Received {len(providers)} providers")
            print(f"\n📋 Providers:")
            for provider in providers:
                status = "✅ CONFIGURED" if provider['configured'] else "❌ NOT CONFIGURED"
                print(f"  • {provider['name']}: {status}")

            # Check if Google Cloud is configured
            google_cloud = next((p for p in providers if p['id'] == 'google-cloud'), None)
            if google_cloud and google_cloud['configured']:
                print(f"\n🎉 Google Cloud TTS is CONFIGURED!")
                return True
            else:
                print(f"\n❌ Google Cloud TTS is NOT configured")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_voices_endpoint():
    """Test the /api/tts/voices/google-cloud endpoint."""
    print_step(2, "Testing Google Cloud Voices Endpoint")

    try:
        headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        print(f"📡 GET {API_BASE_URL}/tts/voices/google-cloud")

        response = requests.get(
            f"{API_BASE_URL}/tts/voices/google-cloud",
            headers=headers,
            timeout=10
        )

        print(f"\n📊 Response Status: {response.status_code}")

        if response.status_code == 200:
            voices = response.json()
            print(f"✅ Success! Received {len(voices)} voices")
            print(f"\n🎤 Available Voices (first 5):")
            for voice in voices[:5]:
                print(f"  • {voice['name']} ({voice['id']}) - {voice.get('description', 'N/A')}")

            if len(voices) > 5:
                print(f"  ... and {len(voices) - 5} more voices")

            return True
        else:
            print(f"❌ Failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_tts_generation():
    """Test actual TTS audio generation."""
    print_step(3, "Testing TTS Audio Generation")

    try:
        headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        # Test with a short phrase
        test_text = "Hello! This is a test of Google Cloud Text to Speech. The audio quality should be excellent."

        payload = {
            "text": test_text,
            "provider": "google-cloud",
            "voice": "en-US-Neural2-F",
            "speed": 1.0,
            "pitch": 0.0
        }

        print(f"📡 POST {API_BASE_URL}/tts/generate")
        print(f"📝 Text: '{test_text}'")
        print(f"🎙️  Voice: {payload['voice']}")
        print(f"🎵 Provider: {payload['provider']}")

        print(f"\n⏳ Generating audio... (this may take a few seconds)")

        response = requests.post(
            f"{API_BASE_URL}/tts/generate",
            headers=headers,
            json=payload,
            timeout=30
        )

        print(f"\n📊 Response Status: {response.status_code}")
        print(f"📦 Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"📏 Content-Length: {len(response.content)} bytes")

        if response.status_code == 200:
            # Check if we received audio
            content_type = response.headers.get('content-type', '')

            if 'audio' in content_type or len(response.content) > 1000:
                print(f"✅ SUCCESS! Received audio data")
                print(f"🎧 Audio size: {len(response.content)} bytes ({len(response.content) / 1024:.2f} KB)")

                # Save audio to file for manual verification
                output_file = Path("test_tts_output.mp3")
                with open(output_file, 'wb') as f:
                    f.write(response.content)

                print(f"💾 Saved audio to: {output_file.absolute()}")
                print(f"🎵 You can play this file to verify audio quality!")

                return True
            else:
                print(f"❌ Response doesn't look like audio")
                print(f"First 200 chars: {response.text[:200]}")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"Error detail: {json.dumps(error_detail, indent=2)}")
            except:
                print(f"Response: {response.text[:500]}")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_live_transcript_simulation():
    """Simulate how live transcript would work."""
    print_step(4, "Simulating Live Transcript")

    test_text = "Hello! I'm your AI mentor. Let me help you understand this topic."
    words = test_text.split()

    print(f"📝 Full text: '{test_text}'")
    print(f"📊 Total words: {len(words)}")
    print(f"\n🎬 Simulating word-by-word display (as it would appear during playback):\n")

    import time
    current_transcript = ""
    for i, word in enumerate(words):
        current_transcript += word + " "
        print(f"\r{current_transcript}▮", end="", flush=True)
        time.sleep(0.18)  # 180ms per word, matching frontend

    print(f"\r{current_transcript}   ")  # Clear cursor
    print(f"\n✅ Live transcript simulation complete!")
    return True

def check_backend_logs_instructions():
    """Provide instructions for checking backend logs."""
    print_step(5, "Backend Logs Verification")

    print("""
🔍 Now check your backend terminal for these log entries:

Expected logs when /tts/providers is called:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔊 [API /tts/providers] Endpoint called
👤 User: student@playstudy.ai
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔊 [TTSProviderFactory] Getting available providers...

🔍 [TTSProviderFactory] Checking provider: google-cloud

🔊 [GoogleCloudTTSProvider] Initializing...
🔊 [GoogleCloudTTSProvider] API Key Present: True
✅ [GoogleCloudTTSProvider] Configured with key: AIzaSyDqI8UatFb...9FZHuipE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Expected logs when /tts/generate is called:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[API /tts/generate] TTS generation requested
[API /tts/generate] User: student@playstudy.ai
[API /tts/generate] Provider: google-cloud
[API /tts/generate] Voice: en-US-Neural2-F
[API /tts/generate] Text length: XXX chars
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ If you see these logs, the backend is working correctly!
❌ If you DON'T see these logs, the requests aren't reaching the backend.
""")

def main():
    """Run all tests."""
    global ACCESS_TOKEN

    print("\n" + "🔊" * 35)
    print("   END-TO-END GOOGLE CLOUD TTS TEST SUITE")
    print("🔊" * 35)

    # Get token from command line or prompt
    if len(sys.argv) > 1:
        ACCESS_TOKEN = sys.argv[1]
    else:
        print("\n⚠️  No access token provided!")
        print("\nUsage:")
        print(f"  python3 {sys.argv[0]} YOUR_ACCESS_TOKEN")
        print("\nOr provide it now:")
        ACCESS_TOKEN = input("Enter your access token: ").strip()

    if not ACCESS_TOKEN:
        print("❌ Access token is required!")
        sys.exit(1)

    print(f"\n🔑 Using token: {ACCESS_TOKEN[:50]}...{ACCESS_TOKEN[-10:]}")
    print(f"🌐 API Base URL: {API_BASE_URL}")

    # Run tests
    results = {
        "providers": False,
        "voices": False,
        "generation": False,
        "simulation": False
    }

    results["providers"] = test_providers_endpoint()

    if results["providers"]:
        results["voices"] = test_voices_endpoint()
        results["generation"] = test_tts_generation()
    else:
        print("\n⚠️  Skipping voice and generation tests (providers not configured)")

    results["simulation"] = test_live_transcript_simulation()

    check_backend_logs_instructions()

    # Summary
    print_header("📊 TEST RESULTS SUMMARY")

    total = len(results)
    passed = sum(1 for v in results.values() if v)

    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}\n")

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}  {test_name}")

    print("\n" + "=" * 70)

    if all(results.values()):
        print("\n🎉 ALL TESTS PASSED!")
        print("\nGoogle Cloud TTS is fully configured and working.")
        print("The live transcript feature should work in Mentor Mode.")
        print("\n📁 Check test_tts_output.mp3 to verify audio quality!")
    else:
        print("\n⚠️  SOME TESTS FAILED")
        print("\nIssues detected:")
        if not results["providers"]:
            print("  ❌ TTS providers endpoint failed - check backend logs")
        if not results["voices"]:
            print("  ❌ Voices endpoint failed - Google Cloud may not be configured")
        if not results["generation"]:
            print("  ❌ Audio generation failed - check API key and backend logs")

        print("\nNext steps:")
        print("  1. Check backend terminal for error messages")
        print("  2. Verify Google Cloud API key is correct")
        print("  3. Run: python3 troubleshoot_tts.py")

    print("\n" + "=" * 70 + "\n")

if __name__ == "__main__":
    main()
