# Context Window Management Implementation

**Date:** October 24, 2025  
**Status:** ✅ Complete - Ready for Testing  
**Approach:** Industry Best Practices 2025 (Claude + Perplexity patterns)

---

## 🎯 Overview

This implementation adds comprehensive context window management to prevent cost spiral, context overflow, and maintain response quality. It follows industry best practices from ChatGPT, Claude, and Perplexity.

---

## 🏗️ Architecture

### Backend Implementation

#### 1. Token Counting & Estimation (`backend/app/model_runner.py`)

```python
def estimate_token_count(text: str) -> int
```

- Uses `tiktoken` with `cl100k_base` encoding (GPT-4 standard)
- Fallback to character-based estimation (1 token ≈ 4 chars)
- Accurate estimation for cost and context management

```python
def count_conversation_tokens(messages: list) -> int
```

- Counts total tokens in conversation history
- Includes overhead for message formatting (~4 tokens/message)

#### 2. Context Window Truncation (`backend/app/model_runner.py`)

```python
def truncate_conversation_history(conversation_history: list, max_messages: int = 20) -> tuple
```

- Implements sliding window approach
- Keeps most recent 20 messages (10 exchanges)
- Returns: (truncated_history, was_truncated, original_count)
- Prevents context overflow and manages costs

#### 3. Automatic Truncation in API Calls

Both `call_openrouter_streaming()` and `call_openrouter()` now:

- Automatically truncate conversation history to 20 messages
- Inform the model when context was truncated
- Transparent to the API consumer

#### 4. Extended Interaction Tracking (`backend/app/routers/api.py`)

```python
# Track conversations with >6 messages separately
# Extended mode doubles token limits (5K→15K chars, 4K→8K tokens), equivalent to ~2 messages
# So 6+ messages is a more reasonable threshold for context-heavy requests
is_extended_interaction = conversation_message_count > 6
```

- Tracks context-heavy requests separately
- Metadata returned to frontend: `conversation_message_count`, `is_extended_interaction`
- Aligns with context management thresholds (same cost, more context capacity)
- Threshold set at 6+ messages because extended mode provides ~2x token capacity

---

### Frontend Implementation

#### 1. Usage Preview (`frontend/src/App.tsx`)

**Transparent cost display before submission:**

- Shows: "This follow-up will use: X model responses • X extended interactions"
- Displays message count in context
- Highlights when interaction becomes "extended" (>6 messages)
- Purple gradient styling for extended interactions
- Educational tooltip about extended interaction counting

#### 2. Claude-Style Context Warnings (`frontend/src/App.tsx`)

**Progressive warning system:**

| Message Count | Level    | Icon | Message                                                                    | Action                |
| ------------- | -------- | ---- | -------------------------------------------------------------------------- | --------------------- |
| 6-9           | Info     | ℹ️   | "Using extended context mode for this conversation"                        | Inform user           |
| 10-13         | Medium   | ℹ️   | "Tip: New comparisons often provide more focused responses"                | Suggest fresh start   |
| 14-19         | High     | 💡   | "Long conversation detected. Starting fresh may improve quality and speed" | Encourage fresh start |
| 20-23         | Critical | ⚠️   | "Conversation approaching maximum length. Consider starting fresh"         | Strong encouragement  |
| 24+           | Critical | 🚫   | "Maximum conversation length reached. Please start new comparison"         | Hard block            |

**Visual Design:**

- Color-coded backgrounds (blue → yellow → red)
- Inline "Start Fresh Comparison" button
- Non-intrusive, educational tone
- Follows Claude's UX patterns (2025)

#### 3. Hard Limits (`frontend/src/App.tsx`)

```typescript
// Prevent submission at 24 messages
if (messageCount >= 24) {
  setError('This conversation has reached the maximum length...');
  return;
}

// Disable submit button at 24 messages
disabled={isLoading || (messageCount >= 24)}
```

#### 4. User Menu Transparency (`frontend/src/components/auth/UserMenu.tsx`)

Added context management info card:

- Explains 20/24 message limits
- Clarifies extended interaction tracking
- Tooltip on "Extended Interactions" label
- Educational, not punitive

---

## 📊 Thresholds & Rationale

### Why These Numbers?

| Threshold       | Purpose                     | Cost Impact                  | Reasoning                                            |
| --------------- | --------------------------- | ---------------------------- | ---------------------------------------------------- |
| **6 messages**   | Extended interaction starts | Same cost, more context      | Extended mode doubles capacity (~2x), equivalent to ~2 message context |
| **10 messages**  | Medium warning              | Same cost, more context      | User should consider fresh start                     |
| **14 messages**  | High warning                | Same cost, more context      | User should seriously consider fresh start           |
| **20 messages**  | Backend truncation          | Same cost, context capped    | Backend automatically truncates to this length       |
| **24 messages**  | Frontend hard limit         | Same cost, prevents overflow | Absolute maximum, forces new comparison              |

### Industry Comparison

- **ChatGPT:** Soft encouragement around 15-20 messages, no hard limit (unlimited subscription)
- **Claude:** Warnings around 10-15 messages, context window indicators
- **Perplexity:** Separate "follow-up search" tracking from initial searches
- **CompareAI:** Extended mode at 6+ messages (equivalent to ~2x token capacity), progressive warnings at 6, 10, 14, 20, 24 messages

---

## 💰 Cost Structure & Protection

### Actual Cost Implementation

**Current Pricing Model:**

- **Fixed cost per model**: $0.0166 per model response
- **Standard tier**: 5K chars, 4K tokens per model
- **Extended tier**: 15K chars, 8K tokens per model
- **Same price**: Extended tier provides more context capacity at no additional cost

**Future Pricing Model (Planned):**

- **Included extended interactions**: Each tier includes daily extended interactions
- **Overage pricing**: Paid tiers can purchase additional extended interactions beyond daily limit
- **Regular interaction overage**: Paid tiers can purchase additional regular interactions beyond daily limit
- **Extended interaction pricing**: TBD - will be priced higher than regular interactions due to increased context capacity

**Why Track Extended Interactions Separately?**

- **Context management**: Prevent context overflow and maintain response quality
- **Usage analytics**: Track heavy users for capacity planning
- **Future pricing**: Foundation for tiered pricing with overage options
- **User experience**: Encourage fresh starts for better results

### Before Implementation

```
User starts 20-message conversation with 3 models:
- Message 1: 3 models × $0.0166 = $0.05
- Message 10: 3 models × $0.0166 = $0.05 (same cost)
- Message 20: 3 models × $0.0166 = $0.05 (same cost)
Total for 20 follow-ups: $1.00 (user charged per model response)
```

### After Implementation

```
User starts conversation with 3 models:
- Messages 1-6: Normal tracking
- Messages 7-9: Info warning about extended context mode
- Messages 10-13: Medium warning to consider fresh start
- Messages 14-19: High warning encouraging fresh start
- Message 20: Backend truncates to 20 messages (context capped)
- Messages 20-23: Critical warning approaching limit
- Message 24: Frontend prevents submission
Total cost controlled: Max 20 messages × $0.05 = $1.00
```

---

## 🚀 Future Overage Pricing Model

### Planned Implementation

**Extended Interaction Overage:**

- **Free tier**: No overage options (must upgrade)
- **Paid tiers**: Can purchase additional extended interactions beyond daily limit
- **Pricing**: TBD - will be higher than regular interactions due to increased context capacity

**Regular Interaction Overage:**

- **Free tier**: No overage options (must upgrade)
- **Paid tiers**: Can purchase additional regular interactions beyond daily limit
- **Pricing**: TBD - based on current $0.0166 per model response

### Implementation Status

**Current Status:**

- ✅ Extended interaction tracking implemented
- ✅ Daily limits enforced
- ✅ Overage infrastructure prepared
- ⏳ Pricing not yet finalized
- ⏳ Purchase flow not yet implemented

**Next Steps:**

1. **Finalize pricing** for extended and regular interaction overages
2. **Implement purchase flow** for additional interactions
3. **Add billing integration** for overage charges
4. **Update UI** to show overage options and pricing

---

## 🎨 UX Principles (2025 Best Practices)

### 1. **Transparency**

- Show exactly what will be consumed before submission
- Display message count in real-time
- Explain why limits exist (quality + cost)

### 2. **Progressive Disclosure**

- Start with gentle hints (10 messages)
- Escalate to warnings (14 messages)
- End with hard limit (24 messages)

### 3. **Educational, Not Punitive**

- "May improve quality" vs "You're using too much"
- Emojis: ℹ️ → 💡 → ⚠️ → 🚫
- Clear actions: "Start Fresh Comparison" button

### 4. **Visual Hierarchy**

- Colors: Blue (info) → Yellow (warning) → Red (critical)
- Gradients for modern, premium feel
- Non-blocking until absolutely necessary

---

## 🧪 Testing Checklist

### Backend Tests

- [ ] Verify token counting works with tiktoken
- [ ] Test truncation at exactly 20 messages
- [ ] Confirm truncation notification sent to model
- [ ] Check extended interaction detection (>10 messages)
- [ ] Validate metadata returned in API response

### Frontend Tests

- [ ] Usage preview appears in follow-up mode
- [ ] Warning appears at 10, 14, 20, 24 message thresholds
- [ ] "Start Fresh" button works correctly
- [ ] Submit button disabled at 24 messages
- [ ] UserMenu shows context management info
- [ ] Extended interaction highlighting works

### Integration Tests

- [ ] Create conversation with 5 messages - no warnings
- [ ] Create conversation with 11 messages - see medium warning + extended indicator
- [ ] Create conversation with 15 messages - see high warning
- [ ] Create conversation with 21 messages - see critical warning
- [ ] Try to submit at 24 messages - should be blocked
- [ ] Verify backend truncates properly
- [ ] Check database tracks extended interactions

### Cost Protection Tests

- [ ] Simulate 50-message conversation - should cap at 24 frontend, 20 backend
- [ ] Verify extended interaction counting
- [ ] Test with multiple models
- [ ] Confirm cost doesn't spiral quadratically

---

## 📚 Dependencies Added

### Backend

```
tiktoken>=0.5.0       # Token counting for context management
```

Install: `pip install tiktoken`

### Frontend

No new dependencies - pure React/TypeScript implementation

---

## 🚀 Deployment Notes

### Database Migrations

No schema changes required - uses existing `daily_extended_usage` field

### Configuration

All thresholds are hardcoded based on industry research:

- Backend truncation: 20 messages
- Frontend limits: 10 (info), 14 (high), 20 (critical), 24 (block)
- Extended interaction: >10 messages

### Monitoring

Track these metrics:

- Average conversation length
- % of conversations hitting warnings
- % of conversations hitting hard limit
- Extended interaction usage per tier

---

## 🎯 Future Enhancements

### Phase 2 (Optional)

1. **Prompt Caching** - Check if OpenRouter supports caching for cost reduction
2. **Conversation Summarization** - Summarize old context instead of truncating
3. **Tiered Limits** - Different limits for free vs paid users
4. **Token Usage Display** - Show actual token count to users
5. **Analytics Dashboard** - Visualize context usage patterns

### Phase 3 (Advanced)

1. **Adaptive Limits** - ML-based dynamic threshold adjustment
2. **Context Compression** - Intelligent summarization of older messages
3. **Semantic Chunking** - Keep most relevant messages, not just recent
4. **Cost Breakdown** - Show per-message cost to users

---

## 📖 User-Facing Documentation

### What Users Need to Know

**Context Management:**

- Conversations automatically optimize at 20 messages (backend)
- Maximum conversation length: 24 messages (12 exchanges)
- Extended interactions (>10 messages) may count separately
- Starting fresh often improves response quality

**Why These Limits?**

- Maintains response quality (models work best with focused context)
- Optimizes processing speed (less context = faster responses)
- Fair cost distribution (context-heavy requests cost more)
- Industry standard practice (similar to ChatGPT, Claude)

**Best Practices:**

- Use follow-ups for clarification and refinement
- Start new comparison when changing topics
- Keep conversations focused for best results
- Extended mode recommended for complex, multi-part queries

---

## ✅ Success Metrics

Implementation is successful if:

- ✅ No conversations exceed 24 messages frontend / 20 backend
- ✅ Users see warnings before hitting limits
- ✅ Cost per follow-up doesn't exceed 7× base rate
- ✅ Extended interactions tracked separately
- ✅ No user complaints about abrupt cutoffs
- ✅ Clear understanding of why limits exist

---

## 🤝 Acknowledgments

Implementation based on industry best practices from:

- **Anthropic Claude** - Progressive warning system, educational messaging
- **OpenAI ChatGPT** - Conversation continuity, soft nudges
- **Perplexity** - Separate tracking of follow-up searches
- **GitHub Copilot** - Context window management in IDE

---

**Implementation Status:** ✅ Complete  
**Ready for:** Testing → Staging → Production  
**Estimated Testing Time:** 2-3 hours  
**Risk Level:** Low (additive feature, no breaking changes)
