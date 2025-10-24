#!/usr/bin/env python3
"""
Test script for streaming endpoint.
Run this to verify that streaming is working correctly.

Usage:
    python test_streaming.py
"""
import requests
import json
import sys


def test_streaming_endpoint(api_url="http://localhost:8000", model="anthropic/claude-3.5-sonnet-20241022"):
    """Test the streaming endpoint with a simple prompt."""

    print("=" * 80)
    print("🚀 Testing OpenRouter Streaming Endpoint")
    print("=" * 80)
    print(f"API URL: {api_url}/compare-stream")
    print(f"Model: {model}")
    print("=" * 80)
    print()

    # Prepare request
    payload = {
        "input_data": "Write a haiku about streaming AI responses",
        "models": [model],
        "tier": "standard",
        "browser_fingerprint": "test-script-fingerprint",
    }

    headers = {"Content-Type": "application/json"}

    print("📤 Sending request...")
    print()

    try:
        # Make streaming request
        with requests.post(f"{api_url}/compare-stream", json=payload, headers=headers, stream=True, timeout=30) as response:

            if response.status_code != 200:
                print(f"❌ Error: HTTP {response.status_code}")
                print(f"Response: {response.text}")
                return False

            print("✅ Connection established")
            print("📡 Streaming response:")
            print("-" * 80)

            # Track events
            events_received = 0
            chunks_received = 0
            content_length = 0
            current_model = None

            # Process streaming response
            for line in response.iter_lines():
                if not line:
                    continue

                line_str = line.decode("utf-8")

                if line_str.startswith("data: "):
                    events_received += 1
                    try:
                        data = json.loads(line_str[6:])  # Remove 'data: ' prefix

                        if data.get("type") == "start":
                            current_model = data.get("model")
                            print(f"\n🎬 Started: {current_model}")
                            print("📝 Content: ", end="", flush=True)

                        elif data.get("type") == "chunk":
                            chunks_received += 1
                            content = data.get("content", "")
                            content_length += len(content)
                            print(content, end="", flush=True)

                        elif data.get("type") == "done":
                            error = data.get("error", False)
                            status = "❌ Error" if error else "✅ Done"
                            print(f"\n{status}: {data.get('model')}")

                        elif data.get("type") == "complete":
                            metadata = data.get("metadata", {})
                            print("\n" + "-" * 80)
                            print("✅ Streaming Complete!")
                            print(f"   - Processing time: {metadata.get('processing_time_ms', 0)}ms")
                            print(f"   - Models successful: {metadata.get('models_successful', 0)}")
                            print(f"   - Models failed: {metadata.get('models_failed', 0)}")

                        elif data.get("type") == "error":
                            print(f"\n❌ Error: {data.get('message')}")
                            return False

                    except json.JSONDecodeError as e:
                        print(f"\n⚠️  Failed to parse JSON: {e}")
                        print(f"   Line: {line_str}")

            print("\n" + "=" * 80)
            print("📊 Statistics:")
            print(f"   - Total events: {events_received}")
            print(f"   - Content chunks: {chunks_received}")
            print(f"   - Total characters: {content_length}")
            print("=" * 80)
            print("\n✅ Streaming test completed successfully!")
            return True

    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to API")
        print("   Make sure the backend is running on http://localhost:8000")
        return False

    except requests.exceptions.Timeout:
        print("❌ Timeout: Request took too long")
        return False

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    # You can customize these
    API_URL = "http://localhost:8000"
    TEST_MODEL = "anthropic/claude-3.5-sonnet-20241022"

    # Override from command line if provided
    if len(sys.argv) > 1:
        API_URL = sys.argv[1]
    if len(sys.argv) > 2:
        TEST_MODEL = sys.argv[2]

    success = test_streaming_endpoint(API_URL, TEST_MODEL)
    sys.exit(0 if success else 1)
