# Testing Concurrent Streaming

## Quick Start

```bash
# Make sure backend is running
cd backend
python test_concurrent_streaming.py
```

## What to Expect

### ✅ Success Output

```
🚀 Testing Concurrent Streaming Endpoint
================================================================================
API URL: http://localhost:8000/compare-stream
Models: 3
  - anthropic/claude-3.5-sonnet-20241022
  - openai/gpt-4o-mini
  - google/gemini-2.0-flash-exp:free
================================================================================

📤 Sending request...

✅ Connection established
📡 Streaming responses (showing interleaved chunks):
--------------------------------------------------------------------------------

🎬 [0.123s] Started: anthropic/claude-3.5-sonnet-20241022
🎬 [0.145s] Started: openai/gpt-4o-mini
🎬 [0.156s] Started: google/gemini-2.0-flash-exp:free

⚡ [0.534s] First chunk from: anthropic/claude-3.5-sonnet-20241022
⚡ [0.678s] First chunk from: openai/gpt-4o-mini
⚡ [0.812s] First chunk from: google/gemini-2.0-flash-exp:free

  📦 [1.234s] claude-3.5-sonnet-202: 5 chunks
  📦 [1.567s] gpt-4o-mini: 5 chunks
  📦 [1.789s] gemini-2.0-flash-ex: 5 chunks
  📦 [2.123s] claude-3.5-sonnet-202: 10 chunks
  ...

✅ Done [5.234s]: anthropic/claude-3.5-sonnet-20241022 (45 chunks)
✅ Done [5.789s]: openai/gpt-4o-mini (38 chunks)
✅ Done [6.123s]: google/gemini-2.0-flash-exp:free (52 chunks)

--------------------------------------------------------------------------------
✅ All Streaming Complete!
   - Total processing time: 6234ms
   - Models successful: 3
   - Models failed: 0

================================================================================
📊 Concurrency Analysis:
================================================================================

⏱️  Start Time Analysis:
   - First model started: 0.123s
   - Last model started: 0.156s
   - Time difference: 0.033s
   ✅ CONCURRENT: All models started nearly simultaneously!

📦 Chunk Interleaving:
   - Different models in first 20 chunks: 3
   ✅ CONCURRENT: Chunks from multiple models arrived interleaved!

⏱️  Individual Model Times:
   - anthropic/claude-3.5-sonnet-20241022:
     • Start: 0.123s
     • First chunk: +0.411s
     • End: 5.234s
     • Duration: 5.111s
     • Total chunks: 45
   - openai/gpt-4o-mini:
     • Start: 0.145s
     • First chunk: +0.533s
     • End: 5.789s
     • Duration: 5.644s
     • Total chunks: 38
   - google/gemini-2.0-flash-exp:free:
     • Start: 0.156s
     • First chunk: +0.656s
     • End: 6.123s
     • Duration: 5.967s
     • Total chunks: 52

🏁 Total wall-clock time: 6.234s
================================================================================

✅ VERDICT: Streaming is CONCURRENT! 🎉
   Models are running in parallel and sending chunks simultaneously.

✅ Test completed successfully!
```

## What the Test Checks

### 1. Start Time Synchronization ⏱️

- **Sequential**: Models start 5+ seconds apart
- **Concurrent**: Models start within 500ms of each other

### 2. Chunk Interleaving 📦

- **Sequential**: First 20 chunks all from one model
- **Concurrent**: First 20 chunks from multiple different models

### 3. Total Time ⏰

- **Sequential**: Sum of all model times (15-45 seconds)
- **Concurrent**: Approximately the slowest model time (5-7 seconds)

## Troubleshooting

### ❌ Connection Error

```
❌ Connection Error: Could not connect to API
   Make sure the backend is running on http://localhost:8000
```

**Solution**: Start the backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### ❌ Sequential Verdict

```
❌ VERDICT: Streaming appears SEQUENTIAL
   Models are running one after another.
```

**Possible causes**:

1. Old code still running (restart backend)
2. Deployment didn't apply changes
3. Check backend logs for errors

### ❌ Timeout

```
❌ Timeout: Request took too long
```

**Possible causes**:

1. OpenRouter API rate limit reached
2. Network issues
3. Models too slow

**Solution**: Try with fewer/faster models

## Manual Testing in Browser

### Steps:

1. **Start backend and frontend**

   ```bash
   # Terminal 1
   cd backend
   python -m uvicorn app.main:app --reload

   # Terminal 2
   cd frontend
   npm run dev
   ```

2. **Open browser**: http://localhost:5173

3. **Select 3 models** (e.g., Claude, GPT-4, Gemini)

4. **Enter prompt**: "Explain concurrent programming"

5. **Submit and observe**:
   - ✅ All 3 "AI" headers appear at same time
   - ✅ Text appears in multiple cards simultaneously
   - ✅ Cards finish at different times
   - ✅ Total time ≈ slowest model (not sum)

### What to Look For:

#### ✅ Concurrent (Expected)

```
[Card 1: Claude]     [Card 2: GPT-4]      [Card 3: Gemini]
AI: 10:30:00 AM      AI: 10:30:00 AM      AI: 10:30:00 AM
Concurrent...        Concurrent is...     In concurrent...
programming is...    when multiple...     programs can...
```

All start at same time, text appears in all cards simultaneously.

#### ❌ Sequential (Not Expected)

```
[Card 1: Claude]     [Card 2: GPT-4]      [Card 3: Gemini]
AI: 10:30:00 AM      AI: 10:30:05 AM      AI: 10:30:10 AM
Full response...     Full response...     Full response...
```

Different start times, cards fill one at a time.

## Advanced Testing

### Test with Different Model Counts

```bash
# Edit test_concurrent_streaming.py
TEST_MODELS = [
    "anthropic/claude-3.5-sonnet-20241022",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
]

python test_concurrent_streaming.py
```

Expected: Still concurrent, total time ≈ slowest model.

### Test Error Handling

Intentionally use an invalid model:

```python
TEST_MODELS = [
    "anthropic/claude-3.5-sonnet-20241022",
    "invalid/model-that-does-not-exist",
    "openai/gpt-4o-mini",
]
```

Expected: Error model fails, but others continue streaming.

## Performance Benchmarks

| Models | Sequential Time | Concurrent Time | Speedup |
| ------ | --------------- | --------------- | ------- |
| 3      | ~15s            | ~5s             | 3x      |
| 6      | ~30s            | ~6s             | 5x      |
| 9      | ~45s            | ~7s             | 6.4x    |

_Actual times vary based on model speed and network latency_

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Concurrent Streaming
  run: |
    cd backend
    python test_concurrent_streaming.py
```

## Questions?

See full documentation:

- `docs/CONCURRENT_STREAMING.md` - Technical details
- `docs/CONCURRENT_STREAMING_DIAGRAM.md` - Visual explanations
- `IMPLEMENTATION_SUMMARY.md` - Complete overview
