# ⚡ Quick Streaming Test Guide

## 🚀 Test It Right Now!

### Step 1: Restart Frontend

```bash
# Stop the frontend (Ctrl+C)
# Then restart:
cd frontend
npm run dev
```

### Step 2: Open Your App

```
http://localhost:5173
(or whatever port your frontend uses)
```

### Step 3: Make a Test Comparison

**Simple Test:**

```
Select: 1 model (any model)
Prompt: "Write a haiku about streaming"
Click: Compare
```

**What You Should See:**

```
┌─────────────────────────────────────┐
│ Claude Sonnet 4.5          [Raw] ✓  │ ← Notice "Raw" tab is active!
│                        [Formatted]  │
├─────────────────────────────────────┤
│ Here's a                            │ ← Text appears immediately!
│ Here's a haiku                      │
│ Here's a haiku about                │ ← Streams word by word
│ Here's a haiku about streaming:     │
│                                     │
│ Bytes flow like rivers              │
│ Data cascades in real-time          │
│ Knowledge streams forth              │
└─────────────────────────────────────┘

[2 seconds later - auto-switch!]

┌─────────────────────────────────────┐
│ Claude Sonnet 4.5          [Raw]    │ ← Now "Formatted" is active!
│                        [Formatted] ✓│
├─────────────────────────────────────┤
│ Here's a haiku about streaming:     │ ← Same text, but now
│                                     │   beautifully formatted
│ Bytes flow like rivers              │   (if there was LaTeX,
│ Data cascades in real-time          │    it would be rendered)
│ Knowledge streams forth              │
└─────────────────────────────────────┘
```

### Step 4: Test with LaTeX

**LaTeX Test:**

```
Select: 1 model
Prompt: "Show me the quadratic formula in LaTeX"
Click: Compare
```

**What You Should See:**

**During Streaming (Raw Tab):**

```
The quadratic formula is:

$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$

This formula gives the solutions...
```

↑ Plain text with visible LaTeX code

**After Streaming (Formatted Tab - Auto-switch):**

```
The quadratic formula is:

    -b ± √(b²-4ac)
x = ─────────────
         2a

This formula gives the solutions...
```

↑ Beautiful rendered equation!

## ✅ Success Indicators

### You'll Know It's Working When:

1. ✅ **"Raw" tab is active** when streaming starts
2. ✅ **Text appears within 1 second**
3. ✅ **Text grows word-by-word** as you watch
4. ✅ **Tab automatically switches** to "Formatted" after ~5-7 seconds
5. ✅ **Console shows logs:**
   ```
   🎬 Streaming started for [model-name]
   ✅ Streaming complete for [model-name]
   ```

### If It's NOT Working:

❌ **Nothing appears for 30+ seconds**

- Problem: Still using old code
- Solution: Hard refresh (Ctrl+Shift+R) or clear cache

❌ **Stays on "Formatted" tab during streaming**

- Problem: State update not happening
- Solution: Check console for errors

❌ **Doesn't auto-switch to "Formatted"**

- Problem: Streaming completion not detected
- Solution: Check backend logs

## 🎮 Interactive Tests

### Test 1: Multi-Model Streaming

```
Select: 3 models
Prompt: "Count to 10"
Expected: All 3 cards show "Raw", all stream independently
```

### Test 2: Manual Tab Switch

```
While streaming is active:
1. Click "Formatted" tab manually
2. See it switch (may render slowly during streaming)
3. Click "Raw" to go back
4. Watch streaming continue
```

### Test 3: Error Handling

```
Select: Invalid model or disconnect internet
Expected: Error shows in Raw tab, tab doesn't auto-switch
```

### Test 4: Very Short Response

```
Prompt: "Say hi"
Expected: Might briefly flash Raw before switching to Formatted
```

### Test 5: Very Long Response (Extended Mode)

```
Enable: Extended tier
Prompt: "Write a detailed essay about AI"
Expected: Streams for 15+ seconds in Raw, then switches
```

## 🔍 Debugging

### Open Browser Console (F12)

**Good Output:**

```javascript
🎬 Streaming started for anthropic/claude-3.5-sonnet-20241022
📤 Streamed 10 chunks for anthropic/claude-3.5-sonnet-20241022, total chars: 234
📤 Streamed 20 chunks for anthropic/claude-3.5-sonnet-20241022, total chars: 456
✅ Streaming complete for anthropic/claude-3.5-sonnet-20241022, error: false
```

**Bad Output (Old Code):**

```javascript
[Nothing for 30 seconds]
[Then suddenly all content appears]
```

### Check Network Tab

1. Open DevTools → Network
2. Find `/compare-stream` request
3. Click it → Response tab
4. Should see `data: {...}` events appearing incrementally

**Good:** New events every 50-100ms  
**Bad:** Everything appears at once after 30+ seconds

## 📊 Performance Comparison

### Before Fix:

```
┌──────────────────────────────────────┐
│ [Loading spinner for 35 seconds...] │
│                                      │
│ [Suddenly everything appears]        │
└──────────────────────────────────────┘
```

### After Fix:

```
┌──────────────────────────────────────┐
│ He ▌                                 │ ← 0.5s
│ Here's ▌                             │ ← 1.0s
│ Here's a Python ▌                    │ ← 1.5s
│ Here's a Python implementation ▌     │ ← 2.0s
│ Here's a Python implementation of... │ ← 2.5s
│                                      │
│ [Auto-switch to Formatted]           │ ← 7.0s
│ [Beautiful rendering appears]        │ ← 7.5s
└──────────────────────────────────────┘
```

## 🎯 Expected Metrics

- **Time to First Visible Text:** < 1 second ✅
- **Streaming Latency:** 50-100ms per update ✅
- **Auto-Switch Delay:** Immediate after streaming ✅
- **LaTeX Render Time:** 1-2 seconds (one-time) ✅
- **Total Perceived Time:** ~2 seconds (feels fast!) ✅

## 🐛 Common Issues

### Issue: Hard refresh still shows old behavior

**Solution:**

```bash
# Clear all cache
1. Open DevTools
2. Right-click refresh button
3. Choose "Empty Cache and Hard Reload"
```

### Issue: Console shows errors

**Solution:**

```bash
# Check if frontend built correctly
cd frontend
npm run build
# Look for any errors
```

### Issue: Backend not streaming

**Solution:**

```bash
# Restart backend
# Stop backend (Ctrl+C)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 🎉 Success!

When you see text streaming in word-by-word in the Raw tab, then auto-switching to beautiful Formatted view after completion, you'll know it's working perfectly!

**Enjoy your 10x faster AI comparison tool!** 🚀✨

---

**Quick Reference:**

- Raw tab = Streaming mode (instant display)
- Formatted tab = Final result (beautiful LaTeX)
- Auto-switch = Happens when streaming completes
- Manual switch = Available anytime via tab buttons

**Happy streaming!** 🎊
