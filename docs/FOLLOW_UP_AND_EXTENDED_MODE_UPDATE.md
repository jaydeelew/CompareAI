# Follow-Up and Extended Mode Update

**Date**: November 3, 2025

## Overview

Updated the application to change how follow-ups and extended mode work, making the system simpler and more transparent for users.

## Key Changes

### 1. Follow-Ups Now Count as Model Comparisons

**Previous Behavior**: Follow-up messages had separate tracking and limits from initial comparisons.

**New Behavior**: Follow-up messages count the same as regular model comparisons. Each follow-up uses the same number of model responses as the number of models selected.

**Impact**: 
- Simpler mental model for users
- All interactions count the same way
- No special "follow-up limits" to track

### 2. Extended Mode is Manual Only

**Previous Behavior**: Extended mode was automatically triggered when a conversation reached 6 messages (varies by tier).

**New Behavior**: Extended mode is ONLY activated when the user explicitly clicks the "Extended mode" button.

**Impact**:
- Users have full control over when to use their extended mode quota
- No surprise consumption of extended mode interactions
- Extended mode button is the single source of truth

### 3. Updated Context Warnings

**Previous Behavior**: Warning at 6 messages mentioned extended mode being triggered.

**New Behavior**: Progressive warnings encourage starting fresh conversations at appropriate intervals:
- **6 messages**: "Reminder: Starting a new comparison helps keep responses sharp and context-focused"
- **10 messages**: "Pro tip: Fresh comparisons provide more focused and relevant responses!"
- **14 messages**: "Consider starting a fresh comparison! New conversations help maintain optimal context"
- **20 messages**: "Time for a fresh start! Starting a new comparison will give you the best response quality"
- **24 messages**: "Maximum conversation length reached" (hard block)

**Impact**:
- More encouraging and positive tone
- Helps users understand benefits of fresh conversations
- Educational rather than punitive

## Technical Changes

### Frontend (`frontend/src/App.tsx`)

1. **Removed** `EXTENDED_MODE_THRESHOLDS` constant
2. **Updated** all logic that checked `messageCount >= extendedThreshold` to only check `isExtendedMode`
3. **Simplified** button disabled/title logic
4. **Updated** warning messages to be more encouraging
5. **Updated** usage preview to only show extended when explicitly enabled

### Backend (`backend/app/routers/api.py`)

- No changes required
- The `is_extended_interaction` tracking variable remains for analytics purposes only
- It does not trigger any automatic extended mode behavior
- The frontend controls whether extended tier is used via the `req.tier` parameter

### Documentation

1. **Updated** `docs/CONTEXT_MANAGEMENT_IMPLEMENTATION.md`:
   - Clarified that `is_extended_interaction` is for analytics only
   - Updated warning message table
   - Removed references to automatic extended mode triggering

## Migration Notes

- No database migration required
- No API changes
- Frontend and backend can be deployed independently
- Users will immediately see the new behavior upon frontend deployment

## Testing Checklist

- [ ] Verify extended mode button is the only way to enable extended mode
- [ ] Confirm follow-ups count as model responses (not separate limit)
- [ ] Check warning messages appear at correct intervals with new text
- [ ] Validate extended mode quota is only used when button is clicked
- [ ] Test that conversation still blocks at 24 messages
- [ ] Verify usage preview shows correct counts

## User-Facing Changes

Users will notice:
1. Follow-ups consume model responses the same as initial comparisons
2. Extended mode is only used when they click the button
3. More encouraging messages about starting fresh conversations
4. Simpler, more transparent usage model

## Backward Compatibility

✅ Fully backward compatible
- No breaking changes to API
- No database schema changes
- Existing conversations continue to work normally

