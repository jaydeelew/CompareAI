# Concurrent Streaming Architecture Diagram

## Before: Sequential Processing ❌

```
User Request → Backend
                  ↓
            Start Model 1
                  ↓
            ████████████████ (5s)
                  ↓
            Done Model 1
                  ↓
            Start Model 2
                  ↓
            ████████████████ (5s)
                  ↓
            Done Model 2
                  ↓
            Start Model 3
                  ↓
            ████████████████ (5s)
                  ↓
            Done Model 3
                  ↓
Total Time: 15 seconds
```

## After: Concurrent Processing ✅

```
User Request → Backend
                  ↓
         ┌────────┼────────┐
         ↓        ↓        ↓
    Start M1  Start M2  Start M3
         ↓        ↓        ↓
    ████████ ████████ ████████
    ████████ ████████ ████████
         ↓        ↓        ↓
    Done M1  Done M2  Done M3
         └────────┼────────┘
                  ↓
Total Time: ~5 seconds (6-9x faster!)
```

## Technical Flow

### Sequential (Old)

```
Time →
0s:  [Model 1 starts........................]
5s:                                         [Model 1 done] [Model 2 starts........................]
10s:                                                                                              [Model 2 done] [Model 3 starts........................]
15s:                                                                                                                                                       [Model 3 done]
```

### Concurrent (New)

```
Time →
0s:  [Model 1 starts..........]
     [Model 2 starts...............]
     [Model 3 starts.......................]
5s:                           [M1 done]
6s:                                  [M2 done]
7s:                                              [M3 done]
```

## Chunk Streaming Visualization

### Sequential

```
Chunks received:
M1: ████████████████████████████████████████  (chunks 1-40, all from Model 1)
M2: ████████████████████████████████████████  (chunks 41-80, all from Model 2)
M3: ████████████████████████████████████████  (chunks 81-120, all from Model 3)
```

### Concurrent

```
Chunks received (interleaved):
Mixed: █1█2█3█1█2█1█3█2█3█1█3█2█1█2█3█1█3█2...
       Model 1 chunks: ▓
       Model 2 chunks: ▒
       Model 3 chunks: ░
```

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  - Receives SSE events from all models             │
│  - Displays chunks as they arrive (interleaved)     │
│  - Tracks individual model start/end times          │
└─────────────────────────────────────────────────────┘
                         ↕ SSE (Server-Sent Events)
┌─────────────────────────────────────────────────────┐
│              Backend (FastAPI + asyncio)             │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │      async def generate_stream()           │    │
│  │                                             │    │
│  │  ┌─────────────────────────────────────┐  │    │
│  │  │   asyncio.Queue (chunk_queue)       │  │    │
│  │  │   - Collects chunks from all models │  │    │
│  │  │   - Thread-safe communication       │  │    │
│  │  └─────────────────────────────────────┘  │    │
│  │         ↑           ↑           ↑          │    │
│  │  ┌──────┴────┐ ┌───┴────┐ ┌────┴─────┐   │    │
│  │  │  Task 1   │ │ Task 2 │ │  Task 3  │   │    │
│  │  │  Model 1  │ │ Model 2│ │  Model 3 │   │    │
│  │  │ (thread)  │ │(thread)│ │ (thread) │   │    │
│  │  └───────────┘ └────────┘ └──────────┘   │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         ↕ HTTPS
┌─────────────────────────────────────────────────────┐
│              OpenRouter API                          │
│  - Receives 3 concurrent requests                   │
│  - Routes to Claude, GPT-4, Gemini, etc.           │
│  - Streams responses back independently             │
└─────────────────────────────────────────────────────┘
```

## Code Flow

### 1. Start Phase (Concurrent)

```python
# All models receive start events simultaneously
for model_id in req.models:
    yield f"data: {{'model': '{model_id}', 'type': 'start'}}\n\n"

# Start timestamp: 2025-10-26T10:00:00.000Z (same for all)
```

### 2. Streaming Phase (Concurrent)

```python
# Tasks run in parallel, push to queue
async def stream_single_model(model_id):
    # Runs in thread pool
    for chunk in call_openrouter_streaming(...):
        await chunk_queue.put({
            'model': model_id,
            'content': chunk
        })

# Main loop yields chunks as they arrive
while tasks_pending:
    chunk = await chunk_queue.get()
    yield f"data: {{'model': ..., 'type': 'chunk', 'content': ...}}\n\n"
```

### 3. Completion Phase (Staggered)

```python
# Each model finishes independently
# Model 1 done: 2025-10-26T10:00:05.123Z
yield f"data: {{'model': 'model1', 'type': 'done'}}\n\n"

# Model 2 done: 2025-10-26T10:00:06.456Z
yield f"data: {{'model': 'model2', 'type': 'done'}}\n\n"

# Model 3 done: 2025-10-26T10:00:07.789Z
yield f"data: {{'model': 'model3', 'type': 'done'}}\n\n"
```

## Benefits Summary

| Aspect          | Sequential    | Concurrent   | Improvement          |
| --------------- | ------------- | ------------ | -------------------- |
| Start times     | Staggered     | Simultaneous | ✅ Better UX         |
| Total time      | Sum of all    | Max of all   | ✅ 3-9x faster       |
| Chunk delivery  | One at a time | Interleaved  | ✅ More responsive   |
| Error isolation | Blocks others | Independent  | ✅ More robust       |
| Resource usage  | Underutilized | Optimal      | ✅ Better efficiency |

## Real-World Example

**User selects 3 models**: Claude 3.5 Sonnet, GPT-4o-mini, Gemini 2.0

### Sequential (Old)

```
00:00 - Start Claude
00:05 - Claude done, start GPT-4
00:10 - GPT-4 done, start Gemini
00:15 - Gemini done
      - User waits 15 seconds for all responses
```

### Concurrent (New)

```
00:00 - Start all 3 models
00:05 - Claude done (fast model)
00:06 - GPT-4 done (medium speed)
00:07 - Gemini done (slowest)
      - User waits 7 seconds for all responses
      - 2.1x faster! 🎉
```

---

**Visual Summary**: Instead of waiting in line at 3 sequential checkouts, all 3 checkouts process simultaneously!
