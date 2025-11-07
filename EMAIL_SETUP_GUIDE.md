# Email Setup Guide - Resend Configuration

## 🔍 Issue Identified

The email system is **working correctly** but has a limitation:

**Resend Free Tier Restriction:**
- When using `onboarding@resend.dev` (default domain), you can **only send emails to the account owner's verified email** (`brayamooti@gmail.com`)
- To send emails to **any email address**, you need to **verify a custom domain** in Resend

## ✅ Current Status

### What's Working:
- ✅ Resend API key is configured correctly
- ✅ Email sending functions work properly
- ✅ Emails sent successfully to `brayamooti@gmail.com` (account owner)
- ✅ All email templates are properly formatted
- ✅ Database migration completed successfully

### What's Not Working:
- ❌ Cannot send emails to other Gmail addresses (domain not verified)
- ❌ Custom domain `lockerroom.com` not verified in Resend

## 🚀 Solution Options

### Option 1: Verify Domain in Resend (Recommended for Production)

1. **Go to Resend Dashboard:**
   - Visit: https://resend.com/domains
   - Log in with your Resend account

2. **Add Your Domain:**
   - Click "Add Domain"
   - Enter: `lockerroom.com` (or your actual domain)
   - Follow DNS verification steps

3. **Update Environment Variables:**
   ```env
   EMAIL_FROM=noreply@lockerroom.com
   EMAIL_FROM_NAME=LockerRoom
   ```

4. **Benefits:**
   - Can send to any email address
   - Professional email appearance
   - Better deliverability
   - Free tier: 3,000 emails/month

### Option 2: Use Resend Default Domain (For Development Only)

**Current Configuration (Already Set):**
```env
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=LockerRoom
```

**Limitations:**
- Can only send to account owner's email (`brayamooti@gmail.com`)
- Not suitable for production
- Users won't receive emails

## 📧 Testing Email System

### Test with Account Owner Email:
```bash
# Test all email types
npx tsx scripts/test-email-system.ts
```

The system will:
- ✅ Send verification emails
- ✅ Send OTP emails  
- ✅ Send password reset emails
- ✅ Send welcome emails
- ✅ Send student account emails

**Note:** Tests only work with `brayamooti@gmail.com` until domain is verified.

### Test Registration Flow:
1. Try registering with `brayamooti@gmail.com` - should receive email
2. Try registering with any other email - will fail silently (domain not verified)

## 🔧 Current Configuration

```env
# Resend Email Service
RESEND_API_KEY=re_gtmKgF5s_3Zc7PeV6nFqVREgbN5QKtV3K
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=LockerRoom
FRONTEND_URL=http://localhost:5173
```

## 📝 Next Steps

### Immediate (For Testing):
1. ✅ Email system is configured correctly
2. ✅ Test registrations with `brayamooti@gmail.com` will work
3. ⚠️  Other email addresses won't receive emails until domain is verified

### For Production:
1. **Verify Domain in Resend:**
   - Add `lockerroom.com` to Resend
   - Complete DNS verification
   - Update `.env` to use verified domain

2. **Update Email From Address:**
   ```env
   EMAIL_FROM=noreply@lockerroom.com
   ```

3. **Test Full Flow:**
   - Register new user → Should receive verification email
   - Verify email → Should receive OTP (for students)
   - Request password reset → Should receive reset email

## 🐛 Troubleshooting

### Issue: "Domain not verified" error
**Solution:** Verify domain in Resend dashboard or use `onboarding@resend.dev` for testing

### Issue: "Only send to your own email" error
**Solution:** This is expected with free tier + default domain. Verify your domain to send to any email.

### Issue: Emails not received
**Check:**
1. Resend dashboard → Emails → Check delivery status
2. Spam folder
3. Server logs for email sending errors
4. Email address is correct

### Issue: Registration fails silently
**Solution:** Check server logs. Email errors are logged but don't block registration.

## 📊 Email System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Resend API Key | ✅ Valid | Configured correctly |
| Email Functions | ✅ Working | All 5 email types tested |
| Database Fields | ✅ Ready | Migration completed |
| Domain Verification | ❌ Not Verified | Required for sending to any email |
| Development Testing | ✅ Working | Works with owner email only |

## 🎯 Summary

**The email system is fully functional but limited by Resend's free tier restrictions.**

- ✅ **For Development:** Use `onboarding@resend.dev` and test with `brayamooti@gmail.com`
- ✅ **For Production:** Verify `lockerroom.com` domain in Resend

**When you register a new user with a Gmail address:**
- The system attempts to send the verification email
- Resend rejects it (domain not verified)
- Registration succeeds but email is not sent
- User cannot verify email and cannot log in

**To fix:** Verify your domain in Resend dashboard, then emails will work for all users.

