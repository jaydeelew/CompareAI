# 🚀 Streaming Deployment Checklist

## Pre-Deployment Testing

### ✅ Backend Testing

- [ ] Backend starts without errors

  ```bash
  cd backend
  uvicorn app.main:app --reload
  # Check: http://localhost:8000/health
  ```

- [ ] Streaming endpoint responds

  ```bash
  python backend/test_streaming.py
  # Should see tokens streaming in real-time
  ```

- [ ] Non-streaming endpoint still works

  ```bash
  curl -X POST http://localhost:8000/compare \
    -H "Content-Type: application/json" \
    -d '{"input_data":"Hi","models":["anthropic/claude-3.5-sonnet-20241022"],"tier":"standard"}'
  ```

- [ ] OpenRouter API key is valid
  ```bash
  echo $OPENROUTER_API_KEY
  # Should not be empty
  ```

### ✅ Frontend Testing

- [ ] Frontend builds without errors

  ```bash
  cd frontend
  npm run build
  ```

- [ ] No TypeScript errors

  ```bash
  npm run type-check
  # or check in IDE
  ```

- [ ] Streaming works in browser

  - [ ] Open http://localhost:5173
  - [ ] Select 1 model
  - [ ] Enter prompt
  - [ ] Click Compare
  - [ ] See tokens streaming in < 1 second

- [ ] Multiple models stream sequentially

  - [ ] Select 2-3 models
  - [ ] Verify each streams one after another

- [ ] Error handling works
  - [ ] Try invalid model
  - [ ] Verify error displays properly

### ✅ Integration Testing

- [ ] Rate limiting works

  - [ ] Test with anonymous user
  - [ ] Test with authenticated user
  - [ ] Verify limits are enforced

- [ ] Extended tier works

  - [ ] Test extended mode
  - [ ] Verify longer responses stream properly

- [ ] Conversation history works

  - [ ] Make initial comparison
  - [ ] Make follow-up
  - [ ] Verify context is maintained

- [ ] Usage tracking logs correctly
  - [ ] Check database for usage_log entries
  - [ ] Verify counts are accurate

## Pre-Production Optimizations

### 🔧 Database Connection Pooling (Recommended)

```python
# In backend/app/database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Uncomment this
    max_overflow=20,       # Uncomment this
    pool_pre_ping=True,    # Uncomment this
    pool_recycle=3600,     # Uncomment this
    echo=False
)
```

**Expected benefit:** 100-300ms faster responses

### 🔧 Nginx Configuration (If Using)

```nginx
# Add to nginx.conf for /compare-stream
location /compare-stream {
    proxy_pass http://backend:8000;
    proxy_buffering off;              # Required!
    proxy_cache off;                  # Required!
    proxy_read_timeout 300s;          # 5 minutes
    proxy_connect_timeout 300s;       # 5 minutes
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

### 🔧 Environment Variables

```bash
# Verify these are set
echo $OPENROUTER_API_KEY          # Should have value
echo $DATABASE_URL                # Should have value
echo $JWT_SECRET_KEY              # Should have value
echo $VITE_API_URL               # Should point to backend
```

## Deployment Steps

### Step 1: Backend Deployment

```bash
# Pull latest code
git pull origin main

# Restart backend
docker-compose restart backend
# or
systemctl restart compareai-backend

# Verify health
curl http://localhost:8000/health
```

### Step 2: Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy dist folder
# (Copy to web server or restart frontend container)

# Verify frontend loads
curl http://localhost:5173
```

### Step 3: Verify Streaming

```bash
# Test streaming endpoint
python backend/test_streaming.py

# Test in browser
# 1. Open app
# 2. Make comparison
# 3. Verify streaming works
```

## Post-Deployment Monitoring

### ⏱️ Performance Metrics

Monitor these for 24 hours:

- [ ] **Time to First Token**
  - Target: < 1 second
  - Check: Browser DevTools → Network → Timing
- [ ] **Stream Completion Rate**

  - Target: > 95%
  - Check: Backend logs for completion events

- [ ] **Error Rate**

  - Target: < 5%
  - Check: Backend logs for error events

- [ ] **Database Performance**
  - Check: Query times in logs
  - Optimize if > 100ms per query

### 📊 User Experience

- [ ] Users report faster response times
- [ ] No increase in error reports
- [ ] Rate limiting still works correctly
- [ ] Usage tracking accurate

### 🐛 Common Issues

#### Issue: Streaming not working

**Check:**

```bash
# Backend logs
docker logs compareai-backend --tail 100

# Frontend console
# Open DevTools → Console

# Network request
# DevTools → Network → compare-stream
```

**Common fixes:**

- Restart backend
- Clear browser cache
- Check nginx buffering settings
- Verify OpenRouter API key

#### Issue: Slow first token (> 2 seconds)

**Check:**

- Database connection pooling enabled?
- Rate limiting queries optimized?
- Network latency to OpenRouter
  ```bash
  ping openrouter.ai
  ```

#### Issue: Streams cut off mid-response

**Check:**

- Nginx timeout settings (should be 300s)
- OpenRouter API timeout
- Network stability

## Rollback Plan

If streaming causes issues:

### Option 1: Quick Rollback (Frontend Only)

```typescript
// In frontend/src/App.tsx, change one line:
const res = await fetch(`${API_URL}/compare`, {  // Change from compare-stream
```

Rebuild and redeploy frontend. Streaming disabled, everything else works.

### Option 2: Full Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Redeploy
docker-compose up -d --build
```

## Success Criteria

Deployment is successful when:

- ✅ All tests pass
- ✅ First token appears in < 1 second
- ✅ Stream completion rate > 95%
- ✅ No increase in errors
- ✅ User feedback is positive
- ✅ Usage tracking accurate
- ✅ Rate limiting works
- ✅ All features functional

## Documentation

Ensure team has access to:

- [ ] `STREAMING_IMPLEMENTATION.md` - Technical details
- [ ] `STREAMING_SUMMARY.md` - Overview and benefits
- [ ] `QUICK_START_STREAMING.md` - Testing guide
- [ ] `DEPLOYMENT_CHECKLIST.md` - This file

## Support Contacts

For issues during deployment:

1. Check logs first
2. Review documentation
3. Test with `test_streaming.py`
4. Check OpenRouter status: https://status.openrouter.ai
5. Review recent code changes

## Timeline

### Day 0 (Deployment Day)

- [ ] Complete all pre-deployment testing
- [ ] Deploy during low-traffic period
- [ ] Monitor for 2 hours post-deployment
- [ ] Verify all metrics

### Day 1

- [ ] Check performance metrics
- [ ] Review error logs
- [ ] Collect user feedback
- [ ] Address any issues

### Week 1

- [ ] Analyze performance trends
- [ ] Optimize if needed
- [ ] Document lessons learned
- [ ] Consider additional optimizations

## Cleanup Tasks

After successful deployment:

- [ ] Remove old non-streaming test code (if any)
- [ ] Archive old performance data
- [ ] Update user-facing documentation
- [ ] Share results with team

## Metrics to Track

### Technical Metrics

```sql
-- Average processing time (from usage_log table)
SELECT AVG(processing_time_ms) FROM usage_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Success rate
SELECT
  SUM(models_successful) as successful,
  SUM(models_failed) as failed,
  (SUM(models_successful)::float / (SUM(models_successful) + SUM(models_failed))) * 100 as success_rate
FROM usage_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Most used models
SELECT
  models_used,
  COUNT(*) as usage_count
FROM usage_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY models_used
ORDER BY usage_count DESC
LIMIT 10;
```

### User Metrics

- [ ] Session duration
- [ ] Comparisons per user
- [ ] User retention
- [ ] Feature adoption rate

## Final Checks

Before marking deployment complete:

- [ ] All tests passing
- [ ] No critical errors in logs
- [ ] Performance meets targets
- [ ] Users reporting good experience
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Monitoring in place
- [ ] Rollback plan tested

---

## 🎉 Deployment Complete!

Once all items are checked:

1. ✅ Mark deployment as complete
2. 📊 Set up ongoing monitoring
3. 📝 Document any deviations from plan
4. 🎓 Share learnings with team
5. 🚀 Enjoy the 10x faster response times!

---

**Deployed By:** ********\_********  
**Date:** ********\_********  
**Version:** 1.0.0  
**Status:** ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
