#!/usr/bin/env python3
"""
Simple Google Cloud TTS Test (No external dependencies)

Uses only standard library - no pip install needed!
"""

import urllib.request
import urllib.error
import json
import sys
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000/api"
ACCESS_TOKEN = None

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

def make_request(url, method='GET', data=None, headers=None):
    """Make HTTP request using urllib."""
    if headers is None:
        headers = {}

    # Prepare request
    req_headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
        **headers
    }

    # Prepare data
    req_data = None
    if data:
        req_data = json.dumps(data).encode('utf-8')

    # Create request
    req = urllib.request.Request(
        url,
        data=req_data,
        headers=req_headers,
        method=method
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content_type = response.headers.get('content-type', '')

            if 'application/json' in content_type:
                return {
                    'status': response.status,
                    'data': json.loads(response.read().decode('utf-8')),
                    'headers': dict(response.headers),
                    'is_json': True
                }
            else:
                return {
                    'status': response.status,
                    'data': response.read(),
                    'headers': dict(response.headers),
                    'is_json': False
                }
    except urllib.error.HTTPError as e:
        return {
            'status': e.code,
            'error': e.read().decode('utf-8'),
            'is_error': True
        }
    except Exception as e:
        return {
            'status': 0,
            'error': str(e),
            'is_error': True
        }

def test_providers():
    """Test providers endpoint."""
    print_step(1, "Testing TTS Providers")

    print(f"📡 GET {API_BASE_URL}/tts/providers")

    response = make_request(f"{API_BASE_URL}/tts/providers")

    if 'is_error' in response:
        print(f"❌ Error: {response['error']}")
        return False

    print(f"📊 Status: {response['status']}")

    if response['status'] == 200 and response['is_json']:
        providers = response['data']
        print(f"✅ Received {len(providers)} providers\n")

        for provider in providers:
            status = "✅ CONFIGURED" if provider['configured'] else "❌ NOT CONFIGURED"
            print(f"  • {provider['name']}: {status}")

        # Check Google Cloud
        google = next((p for p in providers if p['id'] == 'google-cloud'), None)
        if google and google['configured']:
            print(f"\n🎉 Google Cloud TTS is CONFIGURED!")
            return True
        else:
            print(f"\n❌ Google Cloud TTS is NOT configured")
            return False
    else:
        print(f"❌ Unexpected response")
        return False

def test_voices():
    """Test voices endpoint."""
    print_step(2, "Testing Voices")

    print(f"📡 GET {API_BASE_URL}/tts/voices/google-cloud")

    response = make_request(f"{API_BASE_URL}/tts/voices/google-cloud")

    if 'is_error' in response:
        print(f"❌ Error: {response['error']}")
        return False

    print(f"📊 Status: {response['status']}")

    if response['status'] == 200 and response['is_json']:
        voices = response['data']
        print(f"✅ Received {len(voices)} voices\n")
        print(f"🎤 Sample voices:")
        for voice in voices[:5]:
            print(f"  • {voice['name']} ({voice['id']})")
        if len(voices) > 5:
            print(f"  ... and {len(voices) - 5} more")
        return True
    else:
        print(f"❌ Failed")
        return False

def test_generation():
    """Test audio generation."""
    print_step(3, "Testing Audio Generation")

    test_text = "Hello! This is a test of Google Cloud Text to Speech."

    print(f"📡 POST {API_BASE_URL}/tts/generate")
    print(f"📝 Text: '{test_text}'")
    print(f"⏳ Generating audio...\n")

    payload = {
        "text": test_text,
        "provider": "google-cloud",
        "voice": "en-US-Neural2-F",
        "speed": 1.0,
        "pitch": 0.0
    }

    response = make_request(
        f"{API_BASE_URL}/tts/generate",
        method='POST',
        data=payload
    )

    if 'is_error' in response:
        print(f"❌ Error: {response['error']}")
        return False

    print(f"📊 Status: {response['status']}")

    if response['status'] == 200:
        audio_data = response['data']
        size = len(audio_data)

        print(f"✅ SUCCESS! Generated audio")
        print(f"🎧 Size: {size} bytes ({size/1024:.2f} KB)")

        # Save audio
        output_file = Path("test_tts_output.mp3")
        with open(output_file, 'wb') as f:
            f.write(audio_data)

        print(f"💾 Saved to: {output_file.absolute()}")
        print(f"🎵 Play this file to verify quality!")
        return True
    else:
        print(f"❌ Failed")
        if 'error' in response:
            print(f"Error: {response['error']}")
        return False

def simulate_transcript():
    """Simulate live transcript."""
    print_step(4, "Live Transcript Simulation")

    text = "Welcome to your personalized learning session! I'll guide you through each concept step by step, with clear explanations and practice questions."
    words = text.split()

    print(f"📝 Text: '{text}'")
    print(f"📊 Words: {len(words)}\n")
    print(f"🎬 Word-by-word display:\n")

    import time
    current = ""
    for word in words:
        current += word + " "
        print(f"\r{current}▮", end="", flush=True)
        time.sleep(0.18)

    print(f"\r{current}   ")
    print(f"\n✅ Simulation complete!")
    return True

def main():
    """Run tests."""
    global ACCESS_TOKEN

    print("\n" + "🔊" * 35)
    print("   SIMPLE GOOGLE CLOUD TTS TEST")
    print("🔊" * 35)

    # Get token
    if len(sys.argv) > 1:
        ACCESS_TOKEN = sys.argv[1]
    else:
        print("\nUsage: python3 test_tts_simple.py YOUR_TOKEN")
        sys.exit(1)

    print(f"\n🔑 Token: {ACCESS_TOKEN[:50]}...{ACCESS_TOKEN[-10:]}")
    print(f"🌐 API: {API_BASE_URL}")

    # Run tests
    results = {}
    results['providers'] = test_providers()

    if results['providers']:
        results['voices'] = test_voices()
        results['generation'] = test_generation()
    else:
        print("\n⚠️  Skipping remaining tests")
        results['voices'] = False
        results['generation'] = False

    results['simulation'] = simulate_transcript()

    # Summary
    print_header("📊 RESULTS")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\n✅ Passed: {passed}/{total}\n")

    for name, result in results.items():
        icon = "✅" if result else "❌"
        print(f"  {icon}  {name}")

    print("\n" + "=" * 70)

    if all(results.values()):
        print("\n🎉 ALL TESTS PASSED!")
        print("\nGoogle Cloud TTS is working!")
        print("Check test_tts_output.mp3 for audio quality.")
        print("\n📝 NEXT STEPS:")
        print("  1. Play the audio: open test_tts_output.mp3")
        print("  2. Test in your app: Go to Mentor Mode and click Play")
        print("  3. You should hear the same high-quality Google voice")
        print("  4. Live transcript will appear word-by-word as it speaks")
        print("\n🎯 What to expect in Mentor Mode:")
        print("  • Voice Settings shows 'Google Cloud' (not Browser TTS)")
        print("  • 16 voice options available in dropdown")
        print("  • Natural, human-like voice quality")
        print("  • Live transcript synced with audio playback")
    else:
        print("\n⚠️  SOME TESTS FAILED")
        print("\nTroubleshooting:")
        print("  1. Check backend is running (port 8000)")
        print("  2. Verify Google Cloud API key in backend/.env")
        print("  3. Check backend terminal for errors")
        print("  4. Run: python3 troubleshoot_tts.py")

    print()

if __name__ == "__main__":
    main()
