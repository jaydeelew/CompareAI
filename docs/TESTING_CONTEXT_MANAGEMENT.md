# Testing Context Management - Quick Start Guide

**Date:** October 24, 2025  
**Estimated Time:** 15-20 minutes  
**Prerequisites:** Backend + Frontend running locally

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
   - ✅ No warnings
   - ✅ No extended interaction indicator
   - ✅ Smooth operation

---

### Test 2: Medium Conversation (Should show info warning)

1. **Continue from Test 1 OR start fresh**

2. **Follow up until you have 11 messages total** (5-6 exchanges)
   - Keep asking follow-up questions

3. **Expected behavior at 11 messages:**
   - ℹ️ Blue info box appears: "Tip: New comparisons often provide more focused responses"
   - 💜 Purple usage preview shows "1 extended interaction"
   - ✨ "Start Fresh Comparison" button available
   - Submit still works normally

---

### Test 3: Long Conversation (Should show warnings)

1. **Continue following up to 15 messages**

2. **Expected behavior at 15 messages:**
   - 💡 Yellow warning box: "Long conversation detected..."
   - Usage preview still shows extended interaction
   - "Start Fresh" button prominent
   - Submit still works

---

### Test 4: Critical Warning (Should strongly encourage fresh start)

1. **Continue to 21 messages**

2. **Expected behavior at 21 messages:**
   - ⚠️ Red/orange warning: "Conversation approaching maximum length..."
   - Warning is more urgent in tone
   - "Start Fresh" button very prominent
   - Submit still works (for now)

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

**Usage Preview Box (appears at message 11+):**
```
This follow-up will use:
• 3 model responses
• 1 extended interaction [in purple]
💡 Extended interactions use more context...
```

**Warning Progression:**
- 10 msgs: Blue info box, gentle tone
- 14 msgs: Yellow warning, stronger language  
- 20 msgs: Red warning, urgent tone
- 24 msgs: Red critical, submit disabled

**UserMenu (click profile):**
```
Today's Usage: X model responses
Extended Interactions: Y of Z remaining [with ℹ️ tooltip]

💡 Context Management
Conversations auto-limit at 20 messages (backend) 
and 24 messages (frontend)...
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
**Scenario:** Anonymous user with 2 extended interactions, authenticated with 5  
**Expected:** Different limits enforced correctly

---

## 📊 Monitoring Checklist

### In Browser DevTools

**Console logs to look for:**
```
📊 Extended interaction detected: X messages in history
✓ Incremented extended usage for user@email.com: +Y models
```

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
- [ ] Warning appears at 10, 14, 20, 24 message thresholds
- [ ] Submit button disabled at 24 messages
- [ ] Usage preview shows extended interaction at >10 messages
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
- Check metadata in network response
- Verify user's `daily_extended_usage` field
- Check backend condition: `conversation_message_count > 10`

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

### Test 1: Short Conversation (0-9 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 2: Medium Conversation (10-13 messages)  
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 3: Long Conversation (14-19 messages)
- [ ] Pass  [ ] Fail
Notes: _____________________

### Test 4: Critical (20-23 messages)
- [ ] Pass  [ ] Fail  
Notes: _____________________

### Test 5: Hard Limit (24+ messages)
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
    ℹ️ INFO: Gentle suggestion
    💜 Extended interaction marked
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

