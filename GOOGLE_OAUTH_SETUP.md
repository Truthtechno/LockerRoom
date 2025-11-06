# Google OAuth Setup Guide

This guide will help you set up Google OAuth (Gmail sign-in) for the LockerRoom application.

## Overview

Google OAuth allows users to sign in or sign up using their Google account. This is **completely free** and provides a seamless authentication experience.

## Features

- **Login**: Existing users can sign in with their Gmail account without entering a password
- **Signup**: New users can create a viewer account using their Gmail account
- **Automatic Email Verification**: Google-verified emails are automatically marked as verified
- **Profile Picture**: Automatically uses Google profile picture if available

## Setup Instructions

### Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen (see **Step 1.5: Configure OAuth Consent Screen** below for detailed instructions)
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: `LockerRoom Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:5173` (for development)
     - `https://yourdomain.com` (for production)
7. Copy the **Client ID** (you'll need this)

### Step 1.5: Configure OAuth Consent Screen (Detailed)

When creating your OAuth client ID, you'll need to configure the OAuth consent screen. Here's the detailed process:

#### 1.5.1: Initial Setup

1. In Google Cloud Console, navigate to **APIs & Services** > **OAuth consent screen**
2. Choose **User Type**:
   - **External**: For users outside your organization (most common)
   - **Internal**: Only if you have Google Workspace
3. Click **Create**

#### 1.5.2: App Information

Fill in the required fields:

1. **App name**: `LockerRoom` (or your app name)
2. **User support email**: Your support email address
3. **App logo** (optional): Upload your app logo (recommended: 120x120px)
4. **App domain** (optional): Your website domain
5. **Application home page**: `https://yourdomain.com` (or `http://localhost:5173` for development)
6. **Application privacy policy link**: Link to your privacy policy (required for production)
7. **Application terms of service link**: Link to your terms of service (optional)
8. **Authorized domains**: Add your domain (e.g., `yourdomain.com`)
9. **Developer contact information**: Your email address

Click **Save and Continue**

#### 1.5.3: Scopes

1. Click **Add or Remove Scopes**
2. Select the following scopes (or use the filter to find them):
   - `email` - See your primary Google Account email address
   - `profile` - See your personal info, including any personal info you've made publicly available
   - `openid` - Associate you with your personal info on Google
3. Click **Update**, then **Save and Continue**

#### 1.5.4: Test Users (For Testing Mode)

**Important**: When your app is in "Testing" mode, only users you add here can sign in.

1. In the **Test users** section, click **+ ADD USERS**
2. Enter the Gmail addresses of users who should be able to test the app
3. Click **Add**
4. You can add up to 100 test users
5. Click **Save and Continue**

**Note**: Test users will see a warning that the app is not verified. This is normal for testing mode.

#### 1.5.5: Summary

Review your settings and click **Back to Dashboard**

### Understanding Testing Mode vs Production Mode

#### Testing Mode (Default)

When your OAuth consent screen is in **Testing** mode:

- ✅ **Only test users can sign in**: Only Gmail addresses you explicitly add as test users can use Google Sign-In
- ⚠️ **Warning message**: Test users will see a warning that the app hasn't been verified by Google
- ⏰ **Token expiration**: Tokens expire after 7 days, requiring users to re-authenticate
- 👥 **User limit**: Up to 100 test users
- 🔒 **Perfect for**: Development, testing, and staging environments

**When to use**: During development and initial testing phases.

#### Production Mode (Published)

When your app is **Published**:

- ✅ **Anyone can sign in**: Any user with a Google account can sign in (no test user list needed)
- ✅ **No warning messages**: Users won't see verification warnings
- ✅ **Longer token validity**: Tokens last longer (no 7-day expiration)
- ✅ **Unlimited users**: No user limit
- ⚠️ **Verification required**: May require Google's verification process if using sensitive scopes

**When to use**: When your app is ready for public use.

### Step 2: Configure Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google OAuth Client ID (same for frontend and backend)
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

**Note**: The same Client ID is used for both frontend and backend. The `VITE_` prefix makes it available to the frontend in Vite.

### Step 3: Restart Your Server

After adding the environment variables, restart your development server:

```bash
npm run dev
```

## How It Works

### For Existing Users

1. User clicks "Sign in with Google" button
2. Google authentication popup appears
3. User selects their Gmail account
4. System checks if email exists in database
5. If found, user is logged in automatically (no password needed)
6. User is redirected to their dashboard

### For New Users

1. User clicks "Sign up with Google" button
2. Google authentication popup appears
3. User selects their Gmail account
4. System checks if email exists in database
5. If not found, a new viewer account is created:
   - Email: From Google account
   - Name: From Google account (or email prefix if not available)
   - Profile Picture: From Google account (if available)
   - Role: `viewer` (public viewer)
   - Email Verified: Automatically set to `true`
6. Welcome email is sent
7. User is redirected to the feed

## Security Notes

- Google OAuth tokens are verified server-side using Google's official library
- Only verified Google accounts can sign in
- Email addresses are automatically verified (no email verification step needed)
- All existing security checks (frozen accounts, deactivated schools) still apply

## Troubleshooting

### Button Not Appearing

- Check that `VITE_GOOGLE_CLIENT_ID` is set in your `.env` file
- Ensure the Google OAuth script is loaded (check browser console)
- Verify the Client ID is correct

### "Invalid Credential" Error

- Ensure `GOOGLE_CLIENT_ID` matches `VITE_GOOGLE_CLIENT_ID`
- Check that the Client ID is correct in Google Cloud Console
- Verify authorized JavaScript origins include your domain

### "Google OAuth is not configured" Error

- Ensure `GOOGLE_CLIENT_ID` is set in your backend `.env` file
- Restart your server after adding the environment variable

## Cost

**Google OAuth is completely free** - there are no charges for using Google Sign-In, regardless of the number of users.

## Testing

### Testing in Development (Testing Mode)

1. Make sure your environment variables are set
2. **Add test users** in Google Cloud Console:
   - Go to **APIs & Services** > **OAuth consent screen**
   - Scroll to **Test users** section
   - Click **+ ADD USERS**
   - Add your Gmail address (and any other test accounts)
   - Click **Add**
3. Restart your server
4. Go to `/login` or `/signup`
5. You should see a "Sign in with Google" or "Sign up with Google" button
6. Click it and test with a Gmail account that's in your test users list

**Important**: Only Gmail addresses added as test users can sign in when your app is in testing mode.

### What Test Users Will See

When test users try to sign in, they'll see:
- A warning: "Google hasn't verified this app"
- A message: "The app is requesting access to your Google Account"
- An option to continue anyway (since they're test users)

This is **normal and expected** for testing mode. The warning disappears once you publish your app.

## Production Deployment

### Step-by-Step: Publishing Your App for Production

When you're ready to make your app available to all users (not just test users), follow these steps:

#### Step 1: Complete OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **OAuth consent screen**
3. Ensure all required fields are completed:
   - ✅ App name
   - ✅ User support email
   - ✅ Privacy policy URL (required for production)
   - ✅ Terms of service URL (recommended)
   - ✅ Scopes configured (`email`, `profile`, `openid`)
   - ✅ Authorized domains added

#### Step 2: Update OAuth Client Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized JavaScript origins**, add your production domain:
   - `https://yourdomain.com`
   - `https://www.yourdomain.com` (if you use www)
4. Under **Authorized redirect URIs**, add your production domain:
   - `https://yourdomain.com`
   - `https://www.yourdomain.com` (if you use www)
5. Click **Save**

**Note**: You can keep `http://localhost:5173` for local development. Both development and production URLs can coexist.

#### Step 3: Publish Your App

1. Go back to **APIs & Services** > **OAuth consent screen**
2. Scroll to the bottom of the page
3. You'll see a section showing your app's publishing status
4. Click **PUBLISH APP** button
5. Confirm the action in the dialog that appears

**Important Notes**:
- Once published, **anyone** with a Google account can sign in (no test user list needed)
- If you're using only basic scopes (`email`, `profile`, `openid`), publishing is usually instant
- If you're using sensitive or restricted scopes, Google may require verification (see below)

#### Step 4: Google Verification (If Required)

**When verification is required**:
- You're using sensitive scopes (e.g., accessing Google Drive, Gmail, etc.)
- You're using restricted scopes
- Google flags your app for review

**Verification process**:
1. Google will review your app's compliance with their policies
2. You may need to provide:
   - Detailed explanation of how you use the requested scopes
   - Video demonstration of your app
   - Security practices documentation
3. This process can take several days to weeks
4. You'll receive email updates about the verification status

**For basic scopes** (`email`, `profile`, `openid`): Verification is usually **not required**, and publishing is instant.

#### Step 5: Update Production Environment Variables

1. Ensure your production server has the environment variables set:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
   ```
2. Restart your production server after adding/updating variables

#### Step 6: Test Production Sign-In

1. Visit your production site
2. Go to `/login` or `/signup`
3. Click "Sign in with Google" or "Sign up with Google"
4. Test with a Gmail account that was NOT in your test users list
5. Verify the sign-in works correctly

### Alternative: Separate Development and Production Clients

If you prefer to use separate OAuth clients for development and production:

1. **Create two OAuth clients**:
   - One for development (with `localhost:5173`)
   - One for production (with your production domain)

2. **Use different environment variables**:
   - Development `.env`: Use development Client ID
   - Production `.env`: Use production Client ID

3. **Benefits**:
   - Better security isolation
   - Can publish production app while keeping development in testing mode
   - Easier to manage different configurations

### Rollback: Unpublishing Your App

If you need to unpublish your app (return to testing mode):

1. Go to **APIs & Services** > **OAuth consent screen**
2. Click **UNPUBLISH** button
3. Confirm the action
4. Your app returns to testing mode (only test users can sign in)

**Note**: Existing users who already signed in will continue to work until their tokens expire.

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs for authentication errors
3. Verify your Google Cloud Console settings
4. Ensure all environment variables are correctly set

