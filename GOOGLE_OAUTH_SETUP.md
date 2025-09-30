# Google OAuth Setup Guide

This guide walks you through creating Google OAuth credentials for the MCP Memory application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step-by-Step Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "MCP Memory")
5. Click **"Create"**
6. Wait for the project to be created and select it

### 2. Enable Google+ API (Optional but Recommended)

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"People API"**
3. Click on **"Google+ API"** or **"People API"**
4. Click **"Enable"**

> **Note**: NextAuth.js uses this API to fetch user profile information.

### 3. Configure OAuth Consent Screen

1. In the left sidebar, go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (unless you have a Google Workspace account)
3. Click **"Create"**

#### Fill in the required information:

**App Information**
- **App name**: `MCP Memory` (or your preferred name)
- **User support email**: Your email address
- **App logo**: (Optional) Upload a logo if you have one

**App Domain** (Optional for testing)
- **Application home page**: `http://localhost:3000`
- **Application privacy policy link**: (Optional)
- **Application terms of service link**: (Optional)

**Developer Contact Information**
- **Email addresses**: Your email address

4. Click **"Save and Continue"**

#### Scopes

5. On the "Scopes" page, click **"Add or Remove Scopes"**
6. Select the following scopes:
   - `userinfo.email` - See your email address
   - `userinfo.profile` - See your personal info
   - `openid` - Authenticate using OpenID Connect
7. Click **"Update"** then **"Save and Continue"**

#### Test Users (for External Apps)

8. Click **"Add Users"**
9. Add your email address and any other test users
10. Click **"Add"** then **"Save and Continue"**
11. Click **"Back to Dashboard"**

> **Important**: While in "Testing" mode, only added test users can sign in. To allow anyone to sign in, you'll need to publish the app (see section below).

### 4. Create OAuth 2.0 Credentials

1. In the left sidebar, go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Select **"Web application"** as the application type

#### Configure the OAuth Client:

**Name**: `MCP Memory Web Client` (or your preferred name)

**Authorized JavaScript origins**:
- `http://localhost:3000`
- `http://localhost:3001` (if you changed the port)

**Authorized redirect URIs**:
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/google` (if using alternate port)

> **For Production**: Add your production URLs:
> - `https://yourdomain.com`
> - `https://yourdomain.com/api/auth/callback/google`

4. Click **"Create"**

### 5. Copy Your Credentials

A dialog will appear with your credentials:

- **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-abcdefghijklmnop`

**Important**: Copy these values immediately!

### 6. Add Credentials to Your .env File

Open your `.env` file and add the credentials:

```bash
# Google OAuth Credentials
AUTH_GOOGLE_ID="123456789-abcdefg.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-abcdefghijklmnop"
```

Replace the placeholder values with your actual credentials.

### 7. Generate Other Required Secrets

Generate the other required secrets for your `.env` file:

**On macOS/Linux:**
```bash
# Generate NEXTAUTH_SECRET
echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\""

# Generate JWT_SECRET
echo "JWT_SECRET=\"$(openssl rand -base64 32)\""
```

**On Windows (PowerShell):**
```powershell
# Generate NEXTAUTH_SECRET
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Write-Host "NEXTAUTH_SECRET=`"$([Convert]::ToBase64String($bytes))`""

# Generate JWT_SECRET
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Write-Host "JWT_SECRET=`"$([Convert]::ToBase64String($bytes))`""
```

**Or use an online generator:**
- Go to https://generate-secret.vercel.app/32
- Copy the generated string for each secret

### 8. Complete .env File

Your final `.env` file should look like this:

```bash
# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"

# JWT Secret (min 32 characters)
JWT_SECRET="your-generated-jwt-secret-here"

# Google OAuth Credentials
AUTH_GOOGLE_ID="123456789-abcdefg.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-abcdefghijklmnop"
```

## Testing Your Setup

1. Start your application:
```bash
docker-compose up --build
```

2. Open http://localhost:3000 in your browser

3. You should be redirected to the login page

4. Click **"Sign in with Google"**

5. Sign in with one of your test user accounts

6. Grant the requested permissions

7. You should be redirected back to the application

## Publishing Your App (Optional)

If you want to allow any Google user to sign in (not just test users):

1. Go to **"OAuth consent screen"**
2. Click **"Publish App"**
3. Confirm by clicking **"Confirm"**

> **Note**: Google may require verification if you request sensitive or restricted scopes. For basic profile and email scopes, verification is usually not required.

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

**Cause**: The redirect URI doesn't match what's configured in Google Cloud Console.

**Solution**:
1. Check the error message for the redirect URI that was used
2. Go to Google Cloud Console → Credentials
3. Edit your OAuth client
4. Add the exact redirect URI from the error message to "Authorized redirect URIs"

### "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen is not properly configured or app is not published.

**Solution**:
1. Complete the OAuth consent screen configuration
2. Add your email as a test user, or publish the app

### "Error 401: invalid_client"

**Cause**: Client ID or Client Secret is incorrect.

**Solution**:
1. Double-check your `.env` file credentials
2. Make sure there are no extra spaces or quotes
3. Regenerate credentials if needed

### "Error 403: access_denied"

**Cause**: User denied permissions or is not a test user.

**Solution**:
1. If app is in testing mode, add the user as a test user
2. Or publish the app to allow any Google user

## Security Best Practices

1. **Never commit** your `.env` file to version control
2. **Rotate secrets** regularly, especially if they're exposed
3. **Use different credentials** for development and production
4. **Enable 2FA** on your Google account
5. **Review OAuth scopes** - only request what you need
6. **Monitor usage** in Google Cloud Console

## Production Deployment

When deploying to production:

1. **Create new OAuth credentials** for production (don't reuse dev credentials)
2. **Add production URLs** to authorized origins and redirect URIs
3. **Publish the OAuth consent screen**
4. **Set environment variables** in your production environment
5. **Use HTTPS** - Google requires HTTPS for production OAuth

### Example Production URLs:

```bash
NEXTAUTH_URL="https://yourdomain.com"

# In Google Cloud Console, add:
# Authorized JavaScript origins:
#   https://yourdomain.com
#
# Authorized redirect URIs:
#   https://yourdomain.com/api/auth/callback/google
```

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider Docs](https://next-auth.js.org/providers/google)
- [Google Cloud Console](https://console.cloud.google.com/)

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Check Docker logs: `docker-compose logs -f app`
3. Verify all environment variables are set correctly
4. Review the Google Cloud Console audit logs