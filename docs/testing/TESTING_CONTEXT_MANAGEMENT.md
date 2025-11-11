# Testing Context Management - Quick Start Guide

**Date:** October 24, 2025  
**Last Updated:** January 2025  
**Estimated Time:** 15-20 minutes  
**Prerequisites:** Backend + Frontend running locally

---

## 📋 Key Concepts

**Important Distinction:**
- **Extended Mode** (Frontend): User-controlled toggle button (E) that enables extended tier limits (15K chars, 8K tokens). Counts as 1 extended interaction per request.
- **Extended Interaction Tracking** (Backend): Analytics tracking when `conversation_message_count > 6`. This is separate from Extended mode and happens automatically.

**Message Count Thresholds:**
- **6+ messages:** Info warning appears, backend tracks as extended interaction
- **10+ messages:** Medium warning appears
- **14+ messages:** High warning appears
- **20+ messages:** Critical warning, backend truncates history to 20 messages
- **24+ messages:** Critical warning, submit button disabled

---

## 🚀 Quick Test Sequence

### Test 1: Normal Short Conversation (✅ Should work smoothly)

1. **Start fresh comparison**

   - Select 2-3 models
   - Enter: "What is machine learning?"
   - Click Compare

2. **Follow up 3-4 times**
   - "Can you give an example?"
   - "What are the main types?"
   - "Which is most popular?"
3. **Expected behavior:**
   - ✅ No warnings (warnings start at 6+ messages)
   - ✅ Usage preview shows model count (appears in follow-up mode)
   - ✅ Extended mode toggle available but not required
   - ✅ Smooth operation

---

### Test 2: Medium Conversation (Should show info warning)

1. **Continue from Test 1 OR start fresh**

2. **Follow up until you have 11 messages total** (5-6 exchanges)

   - Keep asking follow-up questions

3. **Expected behavior at 11 messages:**
   - 🎯 Medium warning box appears: "Pro tip: Fresh comparisons provide more focused and relevant responses!"
   - Usage preview shows model count and extended usage (if Extended mode is enabled)
   - ✨ "Start Fresh Comparison" button available
   - Submit still works normally

---

### Test 3: Long Conversation (Should show warnings)

1. **Continue following up to 15 messages**

2. **Expected behavior at 15 messages:**
   - 💡 High warning box: "Consider starting a fresh comparison! New conversations help maintain optimal context and response quality."
   - Usage preview still shows model count
   - "Start Fresh" button prominent
   - Submit still works

---

### Test 4: Critical Warning (Should strongly encourage fresh start)

1. **Continue to 21 messages**

2. **Expected behavior at 21 messages:**
   - ✨ Critical warning: "Time for a fresh start! Starting a new comparison will give you the best response quality and speed."
   - Warning is more urgent in tone
   - "Start Fresh" button very prominent
   - Submit still works (for now)
   - Backend truncates conversation history to 20 messages

---

### Test 5: Hard Limit (Should block submission)

1. **Continue to 24 messages**

2. **Expected behavior at 24 messages:**
   - 🚫 Critical red warning: "Maximum conversation length reached..."
   - Submit button becomes **disabled**
   - Hover over submit button shows tooltip
   - Error message if you somehow try to submit
   - Only option: "Start Fresh Comparison"

---

## 🔍 What to Check at Each Stage

### Visual Elements

**Usage Preview Box (appears at message 1+ in follow-up mode):**

```
3 models selected of 47 remaining model responses • 1 extended use selected of 4 remaining
```

**Note:** Extended interactions are counted as **1 per request** (not per model). The usage preview only shows extended usage when Extended mode is explicitly enabled by the user (via the Extended mode toggle button).

**Warning Progression:**

- **6 msgs:** ℹ️ Info level (blue): "Reminder: Starting a new comparison helps keep responses sharp and context-focused."
- **10 msgs:** 🎯 Medium level: "Pro tip: Fresh comparisons provide more focused and relevant responses!"
- **14 msgs:** 💡 High level: "Consider starting a fresh comparison! New conversations help maintain optimal context and response quality."
- **20 msgs:** ✨ Critical level: "Time for a fresh start! Starting a new comparison will give you the best response quality and speed." (Backend truncates to 20 messages)
- **24 msgs:** 🚫 Critical level: "Maximum conversation length reached (24 messages). Please start a fresh comparison for continued assistance." (Submit button disabled)

**UserMenu (click profile):**

```
Today's Usage: X model responses
Extended Interactions: Y of Z remaining [with progress bar]

Note: Extended interactions are tracked separately from regular model responses.
Extended mode can be enabled via the Extended mode toggle button (E) in the form.
```

---

## 🛠️ Testing Backend Truncation

### Test: Backend actually truncates at 20 messages

1. **Create conversation with 25+ messages in database/state**

   - This requires either:
     - Database manipulation, OR
     - Modified frontend temporarily, OR
     - API tool like Postman

2. **Send follow-up with 25 messages in history**

3. **Check backend logs:**

   ```
   Should see: "truncated_history, was_truncated, original_count = (20, True, 25)"
   ```

4. **Check API response metadata:**

   ```json
   {
     "conversation_message_count": 25,
     "is_extended_interaction": true
   }
   ```

5. **Check model receives system message:**
   ```
   "Note: Earlier conversation context (5 messages)
    has been summarized to focus on recent discussion."
   ```

---

## 🐛 Known Edge Cases to Test

### Edge Case 1: Multiple Models with Different Message Counts

**Scenario:** User deselects/reselects models during follow-ups  
**Expected:** Uses first conversation's message count for warnings

### Edge Case 2: Rapid Submissions

**Scenario:** User submits follow-ups quickly before state updates  
**Expected:** Each submission checked independently, no bypass

### Edge Case 3: Page Refresh at 23 Messages

**Scenario:** User refreshes browser during long conversation  
**Expected:** Conversation state persists (localStorage), warnings reappear

### Edge Case 4: Anonymous vs Authenticated Limits

**Scenario:** Anonymous user with 2 extended interactions/day, authenticated with 5/day  
**Expected:** Different limits enforced correctly

### Edge Case 5: Extended Mode vs Extended Interaction Tracking

**Scenario:** User has 6+ messages but Extended mode toggle is OFF  
**Expected:** 
- Backend still tracks as extended interaction (analytics)
- Frontend usage preview does NOT show extended usage
- Extended mode is user-controlled, separate from message count tracking

---

## 📊 Monitoring Checklist

### In Browser DevTools

**Console logs to look for:**

```
📊 Extended interaction detected: X messages in history
✓ Incremented extended usage for user@email.com: +1 extended interaction
```

**Note:** Extended interactions are counted as 1 per request (not per model). Backend tracks extended interactions when `conversation_message_count > 6`, but frontend Extended mode is user-controlled via toggle.

**Network tab:**

- Check `/compare-stream` request body includes `conversation_history`
- Check response metadata includes `conversation_message_count`, `is_extended_interaction`

### In Backend Logs

**Look for:**

```
📤 Streamed chunks for model-id
Authenticated user user@email.com - Usage: X/Y model responses
Extended interaction detected: Z messages
```

---

## ✅ Success Criteria

### Must Pass:

- [ ] No conversation can exceed 24 messages frontend
- [ ] Warning appears at 6, 10, 14, 20, 24 message thresholds
- [ ] Submit button disabled at 24 messages
- [ ] Usage preview appears in follow-up mode (message 1+)
- [ ] Usage preview shows extended usage when Extended mode is enabled
- [ ] "Start Fresh" button works correctly
- [ ] UserMenu shows context management info
- [ ] Backend truncates to 20 messages
- [ ] Extended interaction counted separately in user stats

### Should Pass:

- [ ] Visual warnings follow color progression (blue → yellow → red)
- [ ] Messaging is educational, not punitive
- [ ] Smooth UX, no jarring transitions
- [ ] No console errors
- [ ] Performance not impacted

---

## 🚨 Troubleshooting

### Warning not appearing?

- Check `conversations[0]?.messages.length` in browser console
- Verify `isFollowUpMode` is true
- Check React state updates

### Submit not disabled at 24?

- Inspect button's `disabled` prop
- Check conversation state in React DevTools
- Verify condition logic

### Backend not truncating?

- Check `tiktoken` is installed: `pip list | grep tiktoken`
- Verify import works: `python -c "import tiktoken; print('OK')"`
- Check backend logs for truncation messages

### Extended interaction not counting?

- Check metadata in network response: `is_extended_interaction` flag
- Verify user's `daily_extended_usage` field in database
- Check backend condition: `conversation_message_count > 6` (not > 10)
- **Important:** Frontend Extended mode (user toggle) is separate from backend extended interaction tracking (analytics based on message count)

---

## 🎯 Quick Verification Commands

### Check tiktoken installed:

```bash
cd backend
pip list | grep tiktoken
python -c "import tiktoken; print('tiktoken installed successfully')"
```

### Check frontend builds without errors:

```bash
cd frontend
npm run build
# Should complete without TypeScript errors
```

### Test API endpoint directly:

```bash
curl -X POST http://localhost:8000/compare-stream \
  -H "Content-Type: application/json" \
  -d '{
    "input_data": "test",
    "models": ["anthropic/claude-3.5-sonnet"],
    "conversation_history": [],
    "tier": "standard"
  }'
```

---

## 📝 Test Results Template

```
## Context Management Test Results

Date: _____________
Tester: _____________

### Test 1: Short Conversation (0-5 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 2: Info Warning Appears (6-9 messages)
- [ ] Pass  [ ] Fail
Notes: Info warning should appear at 6+ messages, usage preview visible

### Test 3: Medium Conversation (10-13 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 4: Long Conversation (14-19 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 5: Critical (20-23 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 6: Hard Limit (24+ messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Backend Truncation
- [ ] Pass  [ ] Fail
Notes: _____________________

### Extended Interaction Tracking
- [ ] Pass  [ ] Fail
Notes: _____________________

### Overall Assessment
- [ ] Ready for staging
- [ ] Needs minor fixes
- [ ] Needs major revisions

Issues found: _____________________
```

---

## 🎓 Understanding the Flow

```
User Starts Comparison
         ↓
    [Messages: 0]
         ↓
    Follow-up 1-5
         ↓
    [Messages: 2-10]
    ✅ Normal operation
         ↓
    Follow-up 6+
         ↓
    [Messages: 11-13]
    🎯 MEDIUM: Pro tip message
    (Backend tracks extended interaction if >6 messages)
         ↓
    Follow-up 8+
         ↓
    [Messages: 14-19]
    💡 WARNING: Strong suggestion
         ↓
    Follow-up 10+
         ↓
    [Messages: 20-23]
    ⚠️ CRITICAL: Urgent warning
    🔧 Backend truncates to 20
         ↓
    Follow-up 12
         ↓
    [Messages: 24]
    🚫 BLOCKED: Cannot continue
    ✨ Must start fresh
```

---

**Ready to Test!** 🚀

Start with Test 1 and work through sequentially. Each test builds on the previous one. Should take ~15-20 minutes total.

Good luck! 🎉
