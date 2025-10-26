#!/usr/bin/env python3
"""
Test script for concurrent streaming endpoint.
This tests that multiple models stream concurrently rather than sequentially.

Usage:
    python test_concurrent_streaming.py
"""
import requests
import json
import sys
import time
from collections import defaultdict


def test_concurrent_streaming(api_url="http://localhost:8000", models=None):
    """Test the streaming endpoint with multiple models to verify concurrent execution."""

    if models is None:
        # Test with 3 different models
        models = ["anthropic/claude-3.5-sonnet-20241022", "openai/gpt-4o-mini", "google/gemini-2.0-flash-exp:free"]

    print("=" * 80)
    print("🚀 Testing Concurrent Streaming Endpoint")
    print("=" * 80)
    print(f"API URL: {api_url}/compare-stream")
    print(f"Models: {len(models)}")
    for model in models:
        print(f"  - {model}")
    print("=" * 80)
    print()

    # Prepare request
    payload = {
        "input_data": "Explain the concept of concurrent programming in one short paragraph.",
        "models": models,
        "tier": "standard",
        "browser_fingerprint": "test-concurrent-script",
    }

    headers = {"Content-Type": "application/json"}

    print("📤 Sending request...")
    print()

    try:
        start_time = time.time()

        # Track timing and order of events
        model_start_times = {}
        model_end_times = {}
        model_first_chunk_times = {}
        chunk_order = []  # Track which model sends chunks in what order

        # Make streaming request
        with requests.post(f"{api_url}/compare-stream", json=payload, headers=headers, stream=True, timeout=120) as response:

            if response.status_code != 200:
                print(f"❌ Error: HTTP {response.status_code}")
                print(f"Response: {response.text}")
                return False

            print("✅ Connection established")
            print("📡 Streaming responses (showing interleaved chunks):")
            print("-" * 80)

            # Track events per model
            model_chunks = defaultdict(int)
            model_content = defaultdict(str)

            # Process streaming response
            for line in response.iter_lines():
                if not line:
                    continue

                line_str = line.decode("utf-8")

                if line_str.startswith("data: "):
                    try:
                        data = json.loads(line_str[6:])  # Remove 'data: ' prefix
                        event_time = time.time() - start_time

                        if data.get("type") == "start":
                            model_id = data.get("model")
                            model_start_times[model_id] = event_time
                            print(f"\n🎬 [{event_time:.3f}s] Started: {model_id}")

                        elif data.get("type") == "chunk":
                            model_id = data.get("model")
                            content = data.get("content", "")

                            # Track first chunk time for each model
                            if model_id not in model_first_chunk_times:
                                model_first_chunk_times[model_id] = event_time
                                print(f"⚡ [{event_time:.3f}s] First chunk from: {model_id}")

                            model_chunks[model_id] += 1
                            model_content[model_id] += content
                            chunk_order.append((event_time, model_id))

                            # Print abbreviated model name with chunk indicator
                            model_short = model_id.split("/")[-1][:20]
                            if model_chunks[model_id] % 5 == 0:  # Print every 5th chunk
                                print(f"  📦 [{event_time:.3f}s] {model_short}: {model_chunks[model_id]} chunks", flush=True)

                        elif data.get("type") == "done":
                            model_id = data.get("model")
                            model_end_times[model_id] = event_time
                            error = data.get("error", False)
                            status = "❌ Error" if error else "✅ Done"
                            print(f"\n{status} [{event_time:.3f}s]: {model_id} ({model_chunks[model_id]} chunks)")

                        elif data.get("type") == "complete":
                            metadata = data.get("metadata", {})
                            print("\n" + "-" * 80)
                            print("✅ All Streaming Complete!")
                            print(f"   - Total processing time: {metadata.get('processing_time_ms', 0)}ms")
                            print(f"   - Models successful: {metadata.get('models_successful', 0)}")
                            print(f"   - Models failed: {metadata.get('models_failed', 0)}")

                        elif data.get("type") == "error":
                            print(f"\n❌ Error: {data.get('message')}")
                            return False

                    except json.JSONDecodeError as e:
                        print(f"\n⚠️  Failed to parse JSON: {e}")
                        print(f"   Line: {line_str}")

            # Analysis
            print("\n" + "=" * 80)
            print("📊 Concurrency Analysis:")
            print("=" * 80)

            # Check if models started at the same time (concurrent)
            start_times = list(model_start_times.values())
            if len(start_times) > 1:
                start_time_diff = max(start_times) - min(start_times)
                print(f"\n⏱️  Start Time Analysis:")
                print(f"   - First model started: {min(start_times):.3f}s")
                print(f"   - Last model started: {max(start_times):.3f}s")
                print(f"   - Time difference: {start_time_diff:.3f}s")

                if start_time_diff < 0.5:  # Within 500ms
                    print("   ✅ CONCURRENT: All models started nearly simultaneously!")
                else:
                    print("   ❌ SEQUENTIAL: Models started with significant delay")

            # Check if chunks arrived interleaved (concurrent)
            print(f"\n📦 Chunk Interleaving:")
            if len(chunk_order) > 10:
                # Check if different models appear in the first 20 chunks
                first_20_models = set(model_id for _, model_id in chunk_order[:20])
                print(f"   - Different models in first 20 chunks: {len(first_20_models)}")

                if len(first_20_models) > 1:
                    print("   ✅ CONCURRENT: Chunks from multiple models arrived interleaved!")
                else:
                    print("   ❌ SEQUENTIAL: Only one model sending chunks initially")

            # Show timing for each model
            print(f"\n⏱️  Individual Model Times:")
            for model_id in models:
                if model_id in model_start_times and model_id in model_end_times:
                    duration = model_end_times[model_id] - model_start_times[model_id]
                    first_chunk = model_first_chunk_times.get(model_id, 0) - model_start_times[model_id]
                    print(f"   - {model_id}:")
                    print(f"     • Start: {model_start_times[model_id]:.3f}s")
                    print(f"     • First chunk: +{first_chunk:.3f}s")
                    print(f"     • End: {model_end_times[model_id]:.3f}s")
                    print(f"     • Duration: {duration:.3f}s")
                    print(f"     • Total chunks: {model_chunks[model_id]}")

            total_time = time.time() - start_time
            print(f"\n🏁 Total wall-clock time: {total_time:.3f}s")
            print("=" * 80)

            # Verdict
            if start_time_diff < 0.5 and len(first_20_models) > 1:
                print("\n✅ VERDICT: Streaming is CONCURRENT! 🎉")
                print("   Models are running in parallel and sending chunks simultaneously.")
            else:
                print("\n❌ VERDICT: Streaming appears SEQUENTIAL")
                print("   Models are running one after another.")

            print("\n✅ Test completed successfully!")
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
    TEST_MODELS = ["anthropic/claude-3.5-sonnet-20241022", "openai/gpt-4o-mini", "google/gemini-2.0-flash-exp:free"]

    # Override from command line if provided
    if len(sys.argv) > 1:
        API_URL = sys.argv[1]

    success = test_concurrent_streaming(API_URL, TEST_MODELS)
    sys.exit(0 if success else 1)
