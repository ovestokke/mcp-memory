# Google OAuth Setup Guide

This guide walks you through creating Google OAuth credentials for the MCP Memory application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## For Personal Use Only

This guide configures the app for **your use only**. The app will remain in "Testing" mode with only your email address allowed. No one else can sign in - perfect for personal MCP memory!

## Step-by-Step Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "MCP Memory")
5. Click **"Create"**
6. Wait for the project to be created and select it

### 2. Configure OAuth Consent Screen

#### Initial Setup

1. In the left sidebar, go to **"APIs & Services"** → **"OAuth consent screen"** (or **"Credentials"**)
2. If prompted, select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"** or **"Configure Consent Screen"**

You'll see a new interface with sidebar navigation: **Overview**, **Branding**, **Audience**, **Clients**, **Data access**, **Verification centre**

#### Step 1: Branding

1. Click **"Branding"** in the left sidebar

Fill in the required information:

**App information**
- **App name**: `MCP Memory` (or your preferred name)
- **User support email**: Your email address (dropdown)

**App logo** (Optional)
- Upload a logo if you have one (optional for testing)

**App domain**
- **Application home page**: `https://mcp-memory.vstokke.com` (or leave blank for localhost testing)
- **Application privacy policy link**: (Leave blank for personal use)
- **Application Terms of Service link**: (Leave blank for personal use)

**Authorised domains** (Optional for localhost)
- Add your domain if you have one: e.g., `vstokke.com`

**Developer contact information**
- **Email addresses**: Your email address

2. Click **"Save"** at the bottom

#### Step 2: Audience (Test Users)

1. Click **"Audience"** in the left sidebar

**Publishing status**: Should show **"Testing"** (keep it this way!)

**User type**: **External**

**Test users**:
1. Click **"+ Add users"**
2. Add **only your email address** (e.g., `ovstokke@gmail.com`)
3. Click **"Add"**

> **✅ Personal Use**: By keeping the app in "Testing" mode and only adding your email, the app remains **private and only accessible to you**. No one else can sign in. Don't publish the app!

**OAuth user cap**: Shows "1 user (1 test, 0 other) / 100 user cap"

#### Step 3: Data Access (Scopes)

1. Click **"Data access"** in the left sidebar
2. Scroll to **"Scopes for Google APIs"** section
3. Click **"Add or Remove Scopes"** button
4. Select the following scopes (they should already be included by default):
   - `openid` - Associate you with your personal info on Google
   - `userinfo.email` - See your primary Google Account email address
   - `userinfo.profile` - See your personal info, including any personal info you've made publicly available
5. Click **"Update"**
6. Click **"Save"** at the bottom

> **Note**: These are non-sensitive scopes and don't require verification for personal use.

### 3. Create OAuth 2.0 Credentials

#### Option A: From the Clients Tab (Recommended)

1. Click **"Clients"** in the left sidebar (in the OAuth consent screen)
2. Click **"Create OAuth client"** button
3. Select **"Web application"** as the application type

#### Option B: From Credentials Page

1. Go to **"APIs & Services"** → **"Credentials"** (top navigation)
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
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

### 4. Copy Your Credentials

A dialog will appear with your credentials:

- **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-abcdefghijklmnop`

**Important**: Copy these values immediately!

### 5. Add Credentials to Your .env File

Open your `.env` file and add the credentials:

```bash
# Google OAuth Credentials
AUTH_GOOGLE_ID="123456789-abcdefg.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-abcdefghijklmnop"
```

Replace the placeholder values with your actual credentials.

### 6. Generate Other Required Secrets

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

### 7. Complete .env File

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

## Publishing Your App (Skip This for Personal Use!)

**For personal use, DO NOT publish the app.** Keep it in "Testing" mode with only your email address as a test user. This ensures only you can access it.

<details>
<summary>If you later want to allow other users (click to expand)</summary>

If you want to allow any Google user to sign in:

1. Go to **"OAuth consent screen"**
2. Click **"Publish App"**
3. Confirm by clicking **"Confirm"**

> **Note**: Google may require verification if you request sensitive or restricted scopes. For basic profile and email scopes, verification is usually not required.

</details>

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