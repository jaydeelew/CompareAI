# Performance Optimization Test Checklist

Use this checklist to verify the performance optimizations work correctly.

## ✅ Pre-Deployment Checks

- [ ] Backend optimizations applied to `backend/app/model_runner.py`
- [ ] Frontend optimizations applied to `frontend/src/App.tsx` and `LatexRenderer.tsx`
- [ ] No linter errors in modified files
- [ ] Documentation updated (README, DEV_WORKFLOW)

## 🚀 Deployment Test

### Local Development

```bash
# Restart backend
docker compose restart backend

# Verify backend is running
docker compose ps
# Should show: compareai-backend-1  running

# Check logs for errors
docker compose logs backend | tail -20
# Should NOT show continuous debug messages
```

**Expected Results:**

- ✅ Backend restarts successfully
- ✅ No error messages in logs
- ✅ Logs are clean (no continuous debug output)

---

## 🧪 Functional Tests

### Test 1: Single Model Speed Test

**Purpose:** Verify faster response time with one model

**Steps:**

1. Open http://localhost:5173
2. Select: `anthropic/claude-sonnet-4.5`
3. Enter: `What is 2+2?`
4. Click "Compare Models"
5. Note the time until response appears

**Expected Results:**

- ✅ Response appears in 1-3 seconds
- ✅ Answer is correct (4)
- ✅ No errors in browser console (F12)
- ✅ No errors in backend logs

**Performance Baseline:**

- Before: ~2-4 seconds
- After: ~1-3 seconds
- **Target: Should feel noticeably faster**

---

### Test 2: Multiple Models Speed Test

**Purpose:** Verify optimization scales with multiple models

**Steps:**

1. Select 5 models:
   - `anthropic/claude-sonnet-4.5`
   - `openai/gpt-4o`
   - `google/gemini-2.5-pro`
   - `deepseek/deepseek-chat-v3.1`
   - `mistralai/mistral-large`
2. Enter: `Explain quantum physics in one sentence`
3. Click "Compare Models"
4. Note the time until all responses appear

**Expected Results:**

- ✅ All 5 responses appear in 3-5 seconds
- ✅ All responses are formatted correctly
- ✅ No errors in browser console
- ✅ No visible processing delay after responses arrive

**Performance Baseline:**

- Before: ~4-8 seconds
- After: ~3-5 seconds
- **Target: 1-3 seconds improvement**

---

### Test 3: Mathematical Content Test (Critical!)

**Purpose:** Verify LaTeX/math rendering still works after removing backend cleanup

**Steps:**

1. Select: `google/gemini-2.5-pro` (most prone to MathML issues)
2. Enter: `Solve x² - 5x + 6 = 0 using the quadratic formula. Show all steps.`
3. Click "Compare Models"
4. Inspect the rendered output carefully

**Expected Results:**

- ✅ Math renders with proper LaTeX formatting
- ✅ NO raw MathML tags visible (e.g., `<math xmlns="...">`)
- ✅ NO W3C URLs visible (e.g., `www.w3.org/1998/Math/MathML`)
- ✅ Equations are properly formatted with fraction bars, superscripts
- ✅ Final answer is boxed or clearly indicated

**What to Look For (Should NOT see):**

- ❌ `<math>`
- ❌ `xmlns`
- ❌ `www.w3.org`
- ❌ Raw XML tags
- ❌ Broken equation formatting

---

### Test 4: Complex Math Test

**Purpose:** Verify complex mathematical expressions work

**Steps:**

1. Select any 2 models
2. Enter: `Calculate the integral of x² from 0 to 5. Show your work step by step with proper mathematical notation.`
3. Click "Compare Models"

**Expected Results:**

- ✅ Integral notation renders properly (∫)
- ✅ Limits of integration display correctly
- ✅ All mathematical symbols render (superscripts, fractions, etc.)
- ✅ Final numerical answer is correct (≈41.67)

---

### Test 5: Code Block Test

**Purpose:** Verify code formatting still works

**Steps:**

1. Select any 1 model
2. Enter: `Write a Python function to calculate fibonacci numbers`
3. Click "Compare Models"

**Expected Results:**

- ✅ Code is in a properly formatted code block
- ✅ Syntax highlighting applied (colored keywords)
- ✅ Indentation preserved
- ✅ No mathematical processing applied to code

---

### Test 6: Mixed Content Test

**Purpose:** Verify text + math + code all work together

**Steps:**

1. Select: `openai/gpt-4o`
2. Enter: `Explain the quadratic formula with examples, show the Python code to calculate it, and solve x² - 5x + 6 = 0`
3. Click "Compare Models"

**Expected Results:**

- ✅ Explanation text is readable
- ✅ Mathematical formulas render correctly
- ✅ Code is in formatted blocks
- ✅ All three elements display properly together

---

### Test 7: Error Handling Test

**Purpose:** Verify errors still display properly

**Steps:**

1. Select a non-existent or offline model (if any)
2. Or: Enter extremely long text (10,000+ characters)
3. Click "Compare Models"

**Expected Results:**

- ✅ Error messages display clearly
- ✅ App doesn't crash
- ✅ Other working models still complete
- ✅ User can retry

---

### Test 8: Conversation Follow-up Test

**Purpose:** Verify follow-up conversations still work

**Steps:**

1. Complete Test 1 (single model)
2. After response appears, enter a follow-up: `Why is that the answer?`
3. Click follow-up button

**Expected Results:**

- ✅ Follow-up response appears quickly
- ✅ Context is preserved
- ✅ Response references previous answer
- ✅ Same fast performance

---

## 📊 Performance Metrics

### Metric 1: Backend Processing Time

**How to measure:**

```bash
# Check backend logs
docker compose logs backend | grep -i "processing\|completed\|duration"
```

**What to look for:**

- ✅ NO debug messages about "Raw response"
- ✅ NO debug messages about "After cleanup"
- ✅ NO batch processing status messages
- ✅ Clean, minimal logging

### Metric 2: Browser Network Timing

**How to measure:**

1. Open browser DevTools (F12)
2. Go to Network tab
3. Make a comparison request
4. Find the `/compare` request
5. Check "Timing" tab

**Expected Results:**

- ✅ Waiting (TTFB) should be reasonable (1-5s depending on models)
- ✅ Content Download should be fast (<100ms)
- ✅ Total time should match perceived speed

### Metric 3: CPU Usage

**How to measure:**

```bash
# Check Docker stats during a request
docker stats --no-stream compareai-backend-1
```

**Expected Results:**

- ✅ CPU usage spike should be minimal during processing
- ✅ No sustained high CPU usage after response received

---

## 🐛 Known Issues & Workarounds

### Issue: Still seeing debug messages

**Symptom:** Backend logs show "🔍 DEBUG: Raw response"

**Cause:** Old code still cached

**Fix:**

```bash
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

### Issue: Math not rendering

**Symptom:** Raw LaTeX or MathML visible

**Cause:** Frontend might have cached old code

**Fix:**

```bash
# Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or clear cache
# Settings -> Privacy -> Clear browsing data -> Cached images and files
```

### Issue: Responses seem slower

**Symptom:** Takes longer than before

**Likely Cause:** Network or OpenRouter API issues (not related to optimization)

**Debug:**

```bash
# Check backend is running
docker compose ps

# Check logs for API errors
docker compose logs backend | tail -50

# Restart if needed
docker compose restart backend
```

---

## ✅ Final Verification Checklist

Before marking optimizations as complete:

- [ ] Test 1 (single model) passes - response time improved
- [ ] Test 2 (multiple models) passes - response time improved
- [ ] Test 3 (mathematical content) passes - LaTeX renders correctly
- [ ] Test 4 (complex math) passes - no rendering issues
- [ ] Test 5 (code blocks) passes - proper formatting
- [ ] Test 6 (mixed content) passes - all elements work
- [ ] Test 7 (error handling) passes - errors display properly
- [ ] Test 8 (follow-up) passes - conversations work
- [ ] Backend logs are clean - no debug noise
- [ ] Browser console is clean - no errors
- [ ] Performance feels noticeably improved
- [ ] No regressions in any features

---

## 📈 Success Criteria

**Minimum Requirements:**

- ✅ All 8 functional tests pass
- ✅ Mathematical content renders correctly
- ✅ Response time improved by at least 200ms for single model
- ✅ No errors introduced
- ✅ All existing features work

**Ideal Results:**

- ✅ Response time improved by 500-1000ms for multiple models
- ✅ Backend logs significantly cleaner
- ✅ Users report noticeably faster experience
- ✅ CPU usage reduced during processing

---

## 🎯 Production Deployment Checklist

After successful local testing:

- [ ] All tests pass locally
- [ ] Commit changes with descriptive message
- [ ] Push to master branch
- [ ] SSH to EC2 production server
- [ ] Pull latest changes
- [ ] Restart production backend
- [ ] Run smoke tests on production
- [ ] Monitor logs for 10 minutes
- [ ] Monitor error rates for 24 hours
- [ ] Verify user experience improved

---

## 📝 Test Results Template

Use this to document your test results:

```
Date: ___________
Tester: ___________
Environment: [ ] Local Dev  [ ] Production

TEST RESULTS:
- Test 1 (Single model): [ ] PASS  [ ] FAIL  Time: ___s
- Test 2 (Multiple models): [ ] PASS  [ ] FAIL  Time: ___s
- Test 3 (Math content): [ ] PASS  [ ] FAIL  Notes: ___________
- Test 4 (Complex math): [ ] PASS  [ ] FAIL  Notes: ___________
- Test 5 (Code blocks): [ ] PASS  [ ] FAIL  Notes: ___________
- Test 6 (Mixed content): [ ] PASS  [ ] FAIL  Notes: ___________
- Test 7 (Error handling): [ ] PASS  [ ] FAIL  Notes: ___________
- Test 8 (Follow-up): [ ] PASS  [ ] FAIL  Notes: ___________

PERFORMANCE:
- Perceived speed improvement: [ ] Yes  [ ] No  [ ] Unsure
- Backend logs clean: [ ] Yes  [ ] No
- Browser console clean: [ ] Yes  [ ] No

OVERALL: [ ] READY FOR PRODUCTION  [ ] NEEDS FIXES

Notes: ___________________________________
```

---

## 🆘 Need Help?

If any test fails:

1. **Check documentation:**

   - `PERFORMANCE_SUMMARY.md` - Overview
   - `PERFORMANCE_OPTIMIZATIONS.md` - Technical details
   - `PERFORMANCE_DEPLOYMENT.md` - Deployment guide

2. **Check logs:**

   ```bash
   docker compose logs backend | tail -100
   ```

3. **Rollback if needed:**

   ```bash
   git checkout <previous-commit>
   docker compose restart backend
   ```

4. **Report issue with:**
   - Which test failed
   - Error messages (backend logs + browser console)
   - Steps to reproduce
   - Environment (local/production)
