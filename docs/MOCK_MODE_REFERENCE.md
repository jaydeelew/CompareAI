# Mock Mode - Quick Reference Card

## 🎯 Purpose

Test CompareAI without making real API calls to OpenRouter (saves money during development/testing).

## 🔑 Access

- **Development Mode**: Admins can enable mock mode for any user
- **Production Mode**: Admins can only enable mock mode for admin/super-admin users

## 🚀 Quick Setup

```bash
# 1. Run migration
cd backend && python migrate_mock_mode.py

# 2. Restart backend
docker-compose restart backend
# OR
python -m uvicorn app.main:app --reload
```

## 📍 Toggle Location

**Admin Panel → User List → 🎭 Mock OFF/ON button**

- **🎭 Mock OFF** (gray) = Real API calls
- **🎭 Mock ON** (green) = Mock responses

## 📊 Visual Indicators

### When Mock Mode is Active:

1. **Green button** in admin panel: "🎭 Mock ON"
2. **Green banner** at top of main app: "🎭 Mock Mode Active"
3. **Console logs** in backend: `🎭 Mock mode enabled...`

## 🧪 Mock Response Types

| Tier     | Length      | Tokens     | Use Case               |
| -------- | ----------- | ---------- | ---------------------- |
| Standard | 2,117 chars | ~500-800   | Normal testing         |
| Extended | 5,829 chars | ~1200-1500 | Long response testing  |
| Brief    | 429 chars   | ~200-300   | Short response testing |

## 📝 Files to Know

### Backend

- `backend/app/mock_responses.py` - Edit mock content here
- `backend/migrate_mock_mode.py` - Run once to add feature
- `backend/app/routers/admin.py` - Toggle endpoint (line 476)

### Frontend

- `frontend/src/components/admin/AdminPanel.tsx` - Toggle UI (line 765)
- `frontend/src/App.tsx` - Banner display (line 1987)

## 🔍 Troubleshooting

| Issue                                                                     | Solution                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Button not showing                                                        | User must be admin/super-admin (or any user in dev mode) |
| Not working                                                               | Check backend logs for 🎭 emoji                          |
| Still getting real responses                                              | Verify button shows green "ON"                           |
| Migration fails                                                           | Check DATABASE_URL is set                                |
| "Mock mode can only be enabled for admin/super-admin users in production" | Switch to development mode or use admin account          |

## 💡 Common Commands

```bash
# Check if mock mode column exists
psql -d compareai -c "SELECT mock_mode_enabled FROM users LIMIT 1;"

# See who has mock mode enabled
psql -d compareai -c "SELECT email, mock_mode_enabled FROM users WHERE mock_mode_enabled = true;"

# View mock mode audit log
psql -d compareai -c "SELECT * FROM admin_action_logs WHERE action_type = 'toggle_mock_mode' ORDER BY created_at DESC LIMIT 10;"
```

## 🎓 Best Practices

✅ **DO:**

- Use for UI/UX testing
- Test with multiple models
- Verify tier behavior
- Test streaming responses

❌ **DON'T:**

- Leave enabled in production
- Enable for non-admin users
- Rely on mock data for accuracy

## 📚 Documentation

- **Full Guide**: `MOCK_MODE_TESTING.md`
- **Quick Start**: `MOCK_MODE_QUICKSTART.md`
- **Implementation**: `MOCK_MODE_IMPLEMENTATION_SUMMARY.md`

## 🆘 Need Help?

1. Check backend console for 🎭 logs
2. Review `MOCK_MODE_TESTING.md`
3. Verify database migration succeeded
4. Check user role is admin/super-admin

---

**TL;DR**: Run migration → Restart backend → Toggle in admin panel → See green banner → Get instant mock responses!
