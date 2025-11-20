# reCAPTCHA Troubleshooting Guide

This guide helps diagnose and fix reCAPTCHA verification failures in production.

## Common Error Messages

- `reCAPTCHA verification failed. Please try again.`
- `Failed to load resource: the server responded with a status of 400`
- `Registration error: Error: reCAPTCHA verification failed. Please try again.`

## Root Causes

### 1. Domain Mismatch (Most Common)

**Problem:** reCAPTCHA tokens are domain-specific. If your production domain doesn't match the domain registered in Google reCAPTCHA, verification will fail.

**Solution:**
1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Select your reCAPTCHA site
3. Under "Domains", ensure your production domain is listed (e.g., `compareintel.com`, `www.compareintel.com`)
4. If using a subdomain, add it explicitly (e.g., `app.compareintel.com`)
5. Save changes and wait a few minutes for propagation

**Check:**
- Verify the domain in your browser matches exactly what's registered
- Check for `www` vs non-www mismatch
- Check for HTTP vs HTTPS mismatch (should use HTTPS in production)

### 2. Missing Environment Variables

**Problem:** Environment variables not set correctly in production.

**Backend Check:**
```bash
# In your production environment, verify:
echo $RECAPTCHA_SECRET_KEY
# Should output your secret key (starts with something like 6Le...)
```

**Frontend Check:**
```bash
# Verify the build includes the site key
# Check docker-compose.prod.yml or your build process
# Ensure VITE_RECAPTCHA_SITE_KEY is passed as build arg
```

**Solution:**
1. **Backend:** Set `RECAPTCHA_SECRET_KEY` in your `.env` file or environment
2. **Frontend:** Pass `VITE_RECAPTCHA_SITE_KEY` as a build argument:
   ```yaml
   # docker-compose.prod.yml
   frontend:
     build:
       args:
         - VITE_RECAPTCHA_SITE_KEY=${VITE_RECAPTCHA_SITE_KEY:-}
   ```
3. Rebuild the frontend after setting the variable

### 3. Token Generation Failure

**Problem:** Frontend fails to generate reCAPTCHA token (returns `null`).

**Symptoms:**
- Backend logs show: `reCAPTCHA verification failed: token not provided`
- Frontend console shows: `[reCAPTCHA] Failed to load reCAPTCHA script after timeout`

**Causes:**
- reCAPTCHA script blocked by ad blocker
- Network issues preventing script load
- Site key not set in frontend build
- Script loading timeout

**Solution:**
1. Check browser console for reCAPTCHA script loading errors
2. Disable ad blockers temporarily to test
3. Verify `VITE_RECAPTCHA_SITE_KEY` is set in production build
4. Check network tab for failed requests to `recaptcha/api.js`

### 4. Score Threshold Too Strict

**Problem:** reCAPTCHA score is below 0.5 threshold.

**Symptoms:**
- Backend logs show: `reCAPTCHA verification failed: score too low (score=X, threshold=0.5)`
- Legitimate users being blocked

**Solution:**
1. Check backend logs for actual score values
2. If scores are consistently between 0.3-0.5, consider lowering threshold:
   ```python
   # backend/app/routers/auth.py
   if score < 0.3:  # Lower from 0.5 to 0.3
       return False
   ```
3. Monitor scores over time to find optimal threshold

### 5. Network/Timeout Issues

**Problem:** Backend can't reach Google's reCAPTCHA API.

**Symptoms:**
- Backend logs show: `reCAPTCHA verification timeout` or `reCAPTCHA verification request error`
- Intermittent failures

**Solution:**
1. Check backend server can reach `https://www.google.com/recaptcha/api/siteverify`
2. Check firewall rules allow outbound HTTPS
3. Increase timeout if needed (currently 5 seconds):
   ```python
   async with httpx.AsyncClient(timeout=10.0) as client:  # Increase from 5.0
   ```

### 6. Wrong reCAPTCHA Version

**Problem:** Using reCAPTCHA v2 keys with v3 implementation (or vice versa).

**Solution:**
- Ensure you're using **reCAPTCHA v3** keys
- v3 keys are longer and start with `6L...`
- v2 keys won't work with this implementation

## Debugging Steps

### Step 1: Check Backend Logs

With the improved logging, you should now see detailed error messages:

```bash
# Check backend logs for reCAPTCHA errors
docker-compose logs backend | grep -i recaptcha
# Or if running directly:
tail -f backend/logs/app.log | grep -i recaptcha
```

Look for:
- `reCAPTCHA verification failed: token not provided` → Frontend not sending token
- `reCAPTCHA verification failed: success=false, error_codes=[...]` → Google API error
- `reCAPTCHA verification failed: score too low` → Score threshold issue
- `reCAPTCHA verification timeout` → Network issue

### Step 2: Check Frontend Console

Open browser DevTools (F12) and check Console tab:

```javascript
// Look for these messages:
[reCAPTCHA] Site key not configured, skipping
[reCAPTCHA] Failed to load reCAPTCHA script after timeout
[reCAPTCHA] Token generation error: ...
[reCAPTCHA] Token generated successfully
```

### Step 3: Verify Environment Variables

**Backend:**
```bash
# SSH into production server
cd /path/to/backend
cat .env | grep RECAPTCHA
# Should show: RECAPTCHA_SECRET_KEY=6Le...
```

**Frontend Build:**
```bash
# Check if site key is in the built files
grep -r "VITE_RECAPTCHA_SITE_KEY" frontend/dist/
# Or check the build process
docker-compose config | grep VITE_RECAPTCHA_SITE_KEY
```

### Step 4: Test reCAPTCHA Directly

1. Open your production site
2. Open browser DevTools → Network tab
3. Filter by "recaptcha"
4. Try to register
5. Check if requests to `recaptcha/api.js` succeed
6. Check if token is generated (should see a long token string)

### Step 5: Verify Domain Registration

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Click on your site
3. Check "Domains" section
4. Ensure your production domain is listed exactly as it appears in the browser

## Quick Fixes

### Temporary Disable (Development Only)

If you need to disable reCAPTCHA temporarily for testing:

**Backend:**
```bash
# Remove or comment out RECAPTCHA_SECRET_KEY in .env
# RECAPTCHA_SECRET_KEY=...
```

**Frontend:**
```bash
# Don't set VITE_RECAPTCHA_SITE_KEY in build
```

**⚠️ Warning:** Only do this in development. Never disable in production without an alternative security measure.

### Lower Score Threshold

If legitimate users are being blocked:

```python
# backend/app/routers/auth.py, line ~135
if score < 0.3:  # Lower from 0.5
    return False
```

### Increase Timeout

If experiencing timeouts:

```python
# backend/app/routers/auth.py, line ~118
async with httpx.AsyncClient(timeout=10.0) as client:  # Increase from 5.0
```

## Production Checklist

Before deploying, verify:

- [ ] `RECAPTCHA_SECRET_KEY` is set in backend `.env`
- [ ] `VITE_RECAPTCHA_SITE_KEY` is passed as build arg to frontend
- [ ] Production domain is registered in Google reCAPTCHA Admin
- [ ] Domain matches exactly (including `www` prefix if used)
- [ ] HTTPS is enabled (reCAPTCHA requires HTTPS in production)
- [ ] Backend can reach `https://www.google.com/recaptcha/api/siteverify`
- [ ] Test registration flow in production environment
- [ ] Check backend logs for any reCAPTCHA errors

## Getting Help

If issues persist:

1. **Collect logs:**
   - Backend logs with reCAPTCHA errors
   - Frontend browser console errors
   - Network tab showing reCAPTCHA requests

2. **Check Google reCAPTCHA Admin:**
   - Verify site is active
   - Check domain configuration
   - Review any error messages in the dashboard

3. **Test in isolation:**
   - Try disabling reCAPTCHA temporarily to confirm it's the issue
   - Test with a different domain/key pair
   - Test in incognito mode (to rule out extensions)

## Related Files

- Backend verification: `backend/app/routers/auth.py` (function `verify_recaptcha`)
- Frontend token generation: `frontend/src/components/auth/RegisterForm.tsx` (function `getRecaptchaToken`)
- Environment setup: `docs/getting-started/ENVIRONMENT_SETUP.md`
- Docker config: `docker-compose.prod.yml`, `docker-compose.ssl.yml`

