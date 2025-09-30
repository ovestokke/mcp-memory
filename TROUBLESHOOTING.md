# Troubleshooting Guide

## Google OAuth "400 Error - Malformed Request"

This error means the redirect URI doesn't match what's configured in Google Cloud Console.

### Fix:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Under **"Authorized redirect URIs"**, make sure you have **EXACTLY**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

### Common mistakes:
- ❌ `https://localhost:3000/api/auth/callback/google` (https instead of http)
- ❌ `http://localhost:3000/callback/google` (missing /api/auth)
- ❌ `http://127.0.0.1:3000/api/auth/callback/google` (127.0.0.1 instead of localhost)
- ❌ Different port number

### After fixing:
1. Click **"Save"** in Google Cloud Console
2. Wait 1-2 minutes for changes to propagate
3. Clear browser cookies for localhost:3000
4. Try signing in again

---

## "JWTSessionError: no matching decryption secret"

This happens when you have an old session cookie from a previous `NEXTAUTH_SECRET`.

### Fix:
1. Clear browser cookies for `localhost:3000`
2. Or use an incognito/private window
3. Refresh the page

---

## "UntrustedHost" Error

If you see `UntrustedHost: Host must be trusted` in logs:

### Fix:
Make sure `docker-compose.yml` has:
```yaml
environment:
  - AUTH_TRUST_HOST=true
```

---

## Environment Variables Not Loading

If you see `Invalid URL` with `input: 'undefined'`:

### Fix:
1. Make sure `.env` file exists in the root directory
2. Check all required variables are set:
   ```bash
   cat .env
   ```
3. Restart Docker:
   ```bash
   docker-compose down
   docker-compose up
   ```

---

## Port Already in Use

If you see `Error: bind: address already in use`:

### Fix:
Change the port in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead
```

Then update:
- `.env`: `NEXTAUTH_URL=http://localhost:3001`
- Google Cloud Console redirect URI: `http://localhost:3001/api/auth/callback/google`

---

## Check What's Actually Running

```bash
# View logs
docker-compose logs -f app

# Check if container is running
docker-compose ps

# Check environment variables inside container
docker-compose exec app env | grep -E "(NEXTAUTH|JWT|AUTH_GOOGLE)"

# Restart from scratch
docker-compose down -v
docker-compose up --build
```

---

## Can't Access http://localhost:3000

1. Check container is running: `docker-compose ps`
2. Check port mapping: `docker-compose logs app | head -20`
3. Try: `curl http://localhost:3000`
4. On Windows, try: `http://127.0.0.1:3000` instead

---

## Google OAuth Consent Screen Issues

### "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured or missing required fields.

**Fix:**
1. Go to Google Cloud Console → OAuth consent screen → Branding
2. Fill in all required fields (App name, User support email, Developer email)
3. Click Save

### "Error 403: access_denied"

**Cause:** Your email is not added as a test user.

**Fix:**
1. Go to OAuth consent screen → Audience
2. Click "Add users"
3. Add your email address
4. Click Save

---

## Still Having Issues?

1. **Check NextAuth logs:** Look in `docker-compose logs app` for detailed error messages
2. **Check browser console:** Open DevTools (F12) → Console tab
3. **Check Google Cloud Console audit logs:** See what requests are being made
4. **Verify all URLs match:**
   - `.env` NEXTAUTH_URL
   - Google OAuth redirect URI
   - Google OAuth authorized JavaScript origin

### Get more verbose logging:

Add to `docker-compose.yml`:
```yaml
environment:
  - DEBUG=true
  - NEXTAUTH_DEBUG=true
```