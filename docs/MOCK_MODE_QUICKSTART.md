# Mock Mode - Quick Start Guide

## 🚀 Get Started in 3 Minutes

This quick guide will help you set up and start using the Mock Mode feature for testing.

## Step 1: Run Migration (1 minute)

```bash
cd backend
python migrate_mock_mode.py
```

You should see:
```
====================================================
CompareAI - Mock Mode Migration
====================================================

🔗 Connecting to database...
📝 Adding mock_mode_enabled column to users table...
✅ Successfully added mock_mode_enabled column
✅ Verified: mock_mode_enabled (boolean) with default: false

🎉 Migration completed successfully!
```

## Step 2: Restart Backend (30 seconds)

```bash
# If using Docker
docker-compose restart backend

# If running locally
cd backend
python -m uvicorn app.main:app --reload
```

## Step 3: Enable Mock Mode (30 seconds)

1. Log in to CompareAI as an **admin** or **super-admin**
2. Click "Admin Panel" in the user menu
3. Find yourself (or another admin) in the user list
4. Click the "🎭 Mock OFF" button
5. Button turns green: "🎭 Mock ON" ✅

## Step 4: Test It! (1 minute)

1. Go back to the main CompareAI interface
2. Select any 3-5 models
3. Enter a test prompt: "Explain quantum computing"
4. Click "Compare"
5. Watch mock responses stream in instantly! 🎭

## What You Should See

### In the Browser:
- All models return responses instantly
- Responses are realistic and well-formatted
- No delays or network issues

### In Backend Console:
```
🎭 Mock mode active for user admin@example.com
🎭 Mock mode enabled - returning mock standard response for anthropic/claude-3.5-sonnet
🎭 Mock mode enabled - returning mock standard response for openai/gpt-4-turbo
```

## Toggle Mock Mode Off

When you're done testing:
1. Return to Admin Panel
2. Click "🎭 Mock ON" (green button)
3. Button turns gray: "🎭 Mock OFF" ✅

Now you're back to using real API calls!

## Quick Tips

✅ **DO**:
- Use mock mode for UI testing
- Test with multiple models simultaneously
- Try both Standard and Extended tiers
- Test follow-up conversations

❌ **DON'T**:
- Use mock mode for actual work
- Leave mock mode on indefinitely
- Enable mock mode for non-admin users (won't work)

## Troubleshooting

**Q: Button doesn't appear?**  
A: Make sure user has `admin` or `super_admin` role

**Q: Mock mode not working?**  
A: Check backend console for 🎭 emoji logs

**Q: Getting real responses instead of mocks?**  
A: Verify button shows "🎭 Mock ON" (green)

## Next Steps

For more detailed information, see:
- [Full Documentation](MOCK_MODE_TESTING.md)
- [Admin Management System](ADMIN_MANAGEMENT_SYSTEM.md)

---

**Need Help?** Check backend logs or review the full documentation.

