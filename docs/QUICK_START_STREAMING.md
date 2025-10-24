# Quick Start: Testing Streaming

## 🚀 Fast Track - Test Streaming in 2 Minutes

### Step 1: Verify Backend is Running

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy"}`

### Step 2: Test Streaming Endpoint

```bash
cd /home/dan_wsl/jaydeelew/CompareAI/backend
python test_streaming.py
```

Expected output:

```
🚀 Testing OpenRouter Streaming Endpoint
================================================================================
✅ Connection established
📡 Streaming response:
--------------------------------------------------------------------------------

🎬 Started: anthropic/claude-3.5-sonnet-20241022
📝 Content: [Haiku text streams here in real-time]
✅ Done: anthropic/claude-3.5-sonnet-20241022
--------------------------------------------------------------------------------
✅ Streaming Complete!
   - Processing time: ~5000ms
   - Models successful: 1
   - Models failed: 0
```

### Step 3: Test in Browser

1. Open your app: `http://localhost:5173` (or your frontend URL)
2. Select **1 model** (e.g., Claude 3.5 Sonnet)
3. Enter prompt: "Write a haiku about streaming"
4. Click **Compare**
5. Watch tokens appear in **real-time**! 🎉

## ✅ What You Should See

### Before (Non-Streaming)

- Click "Compare"
- Wait 6+ seconds with no feedback
- Response appears all at once
- Feels slow 😞

### After (Streaming)

- Click "Compare"
- First tokens appear in **< 1 second**!
- Text streams in word-by-word
- Feels instant! 🚀

## 🔧 Troubleshooting

### Problem: Test script fails with "Connection Error"

**Solution:** Start the backend

```bash
cd /home/dan_wsl/jaydeelew/CompareAI
docker-compose up backend
# or
cd backend
uvicorn app.main:app --reload
```

### Problem: Streaming works in test script but not browser

**Solution:** Check frontend is using the streaming endpoint

- Open DevTools → Network
- Look for request to `/compare-stream` (not `/compare`)
- If it's calling `/compare`, frontend code needs the update

### Problem: Getting 401 Unauthorized

**Solution:** Make sure OpenRouter API key is set

```bash
# Check .env file
cat /home/dan_wsl/jaydeelew/CompareAI/.env | grep OPENROUTER
```

### Problem: Streaming is slow to start (> 2 seconds)

**Solution:** Optimize database queries

```python
# In backend/app/database.py, uncomment:
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
```

## 📊 Performance Comparison

### Test with Single Model

**Non-Streaming (Old Way):**

```bash
time curl -X POST http://localhost:8000/compare \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "Hi",
    "models": ["anthropic/claude-3.5-sonnet-20241022"],
    "tier": "standard"
  }'
```

Result: **~6-7 seconds** total, no output until done

**Streaming (New Way):**

```bash
time curl -N -X POST http://localhost:8000/compare-stream \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "Hi",
    "models": ["anthropic/claude-3.5-sonnet-20241022"],
    "tier": "standard"
  }'
```

Result: **~0.5 seconds** to first token, then continuous stream

## 🎯 Quick Verification Checklist

- [ ] Backend running and healthy
- [ ] Test script runs successfully
- [ ] Browser shows real-time streaming
- [ ] First tokens appear in < 1 second
- [ ] Multiple models stream sequentially
- [ ] Errors display correctly
- [ ] Rate limiting still works
- [ ] Usage tracking logs correctly

## 📝 Next Steps

Once streaming is working:

1. **Monitor Performance**

   ```bash
   # Check logs for timing
   docker logs -f compareai-backend | grep "Processing time"
   ```

2. **Enable Database Pooling** (if needed)

   - Edit `backend/app/database.py`
   - Uncomment pooling settings
   - Restart backend

3. **Test with Multiple Models**

   - Select 2-3 models in UI
   - Verify they stream sequentially
   - Check timing for each

4. **Deploy to Production**
   - Update nginx config for streaming
   - Set appropriate timeouts
   - Monitor first token latency

## 🆘 Getting Help

If you encounter issues:

1. **Check backend logs:**

   ```bash
   docker logs compareai-backend --tail 100
   ```

2. **Check frontend console:**

   - Open DevTools → Console
   - Look for SSE parsing errors

3. **Verify OpenRouter status:**

   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

4. **Test with minimal example:**
   ```bash
   python backend/test_streaming.py http://localhost:8000 "anthropic/claude-3.5-sonnet-20241022"
   ```

## ✨ Success!

If you see tokens streaming in real-time, **congratulations!** 🎉

Your app now has a **10x faster perceived response time** and will feel much more responsive to users!

---

**Quick Reference:**

- 📁 Documentation: `STREAMING_IMPLEMENTATION.md`
- 📋 Summary: `STREAMING_SUMMARY.md`
- 🧪 Test Script: `backend/test_streaming.py`
- 🐛 Troubleshooting: See documentation files above

**Status Check:**

```bash
# One-liner to test everything
curl -s http://localhost:8000/health && echo "✅ Backend OK" && python backend/test_streaming.py && echo "✅ Streaming OK"
```
