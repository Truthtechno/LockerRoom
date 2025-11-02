# Company Information Placement Guide (Mobile-First Approach)

## Overview
This document explains where company information configured in System Config should be displayed throughout the LockerRoom application. **This guide follows mobile-first app patterns similar to Instagram and TikTok**, where company information is primarily accessed through Settings rather than traditional web footers.

## Information Fields
The following information can be configured in **System Config → Branding Tab**:

### Company Information
- **Company Name** - The official name of your organization
- **Company Address** - Street address
- **City, State/Province, ZIP/Postal Code, Country** - Location details
- **Company Description** - Brief description about the company

### Contact Information
- **Contact Email** - Primary email for inquiries
- **Contact Phone** - Primary phone number
- **Website URL** - Official company website

### Social Media
- **Facebook** - Facebook page URL
- **X (Twitter)** - X profile URL
- **Instagram** - Instagram profile URL
- **TikTok** - TikTok profile URL

## Recommended Placement Locations (Mobile-First)

### 1. **Settings → Support & Help Section** ✅ (PRIMARY - IMPLEMENTED)
**Location:** `client/src/pages/settings.tsx`

**This is the PRIMARY location** for all company information in a mobile-first app. Users expect to find support and company information in Settings, just like Instagram, TikTok, and other professional mobile apps.

**Features:**
- "About [Company Name]" button linking to full About page
- Contact information (email, phone, website) with clickable links
- Social media links
- Clean, organized layout following mobile app patterns

**Why This is Best:**
- ✅ Matches user expectations from popular mobile apps
- ✅ Always accessible but not intrusive
- ✅ Professional and app-like experience
- ✅ Works perfectly on both mobile and web
- ✅ Follows industry standards (Instagram, TikTok, Twitter, etc.)

### 2. **About Page** ✅ (IMPLEMENTED)
**Location:** `client/src/pages/about.tsx`
**Route:** `/about`

A dedicated "About Us" page accessible from Settings that displays:
- Company logo and name
- Full company description
- Complete address information
- All contact methods (email, phone, website)
- Social media links with icons
- App information and copyright

**Access:** Users navigate here from Settings → Support & Help → "About [Company Name]"

**Why This is Important:**
- ✅ Provides comprehensive company information
- ✅ Professional presentation
- ✅ Can be bookmarked/shared if needed
- ✅ Follows mobile app patterns (e.g., Instagram's "About" screen)

### 3. **Minimal Footer (Web-Only)** ✅ (OPTIONAL - IMPLEMENTED)
**Location:** `client/src/components/layout/footer.tsx`

**IMPORTANT:** This footer is designed to be minimal and **web-only**. Mobile apps (like Instagram, TikTok) don't have footers on every screen. The footer should only be used on web versions and should be minimal.

**Features:**
- Copyright notice
- Quick links (Contact, About)
- Social media icons
- **Hidden on mobile devices** (uses `hidden lg:block`)

**Usage:**
```tsx
// Minimal footer for web only
<Footer minimal={true} />
```

**Where to Use:**
- ✅ Optional on web-only pages (if desired)
- ❌ **DO NOT** add to mobile-first content pages (Feed, Profile, etc.)
- ❌ **DO NOT** make it prominent or intrusive

### 4. **Email Templates** (RECOMMENDED)
**Location:** Wherever email notifications are sent

Use contact information in:
- Email signatures
- "Reply-To" addresses
- Support email communications
- Transactional emails (receipts, confirmations)

**Fields to Use:**
- `contactEmail` - Use as sender/reply-to address
- `companyName` - Include in email headers/footers
- `websiteUrl` - Include in email footers

### 5. **Login/Signup Pages** (OPTIONAL)
**Location:** `client/src/pages/login.tsx`, `client/src/pages/signup.tsx`

**Light touch only:**
- Company name in page header (already done via branding)
- Subtle "Need help? Contact support" link (if desired)
- **Do NOT add full footer or heavy company info** - keep it clean and focused

### 6. **Error Pages** (RECOMMENDED - NOT YET CREATED)
**Location:** Error page components (404, 500, etc.)

Display:
- Company name
- Support contact email
- Link back to main site

## Implementation Status

✅ **Completed (Mobile-First Approach):**
- Support & Help section added to Settings page
- About page created and accessible from Settings
- Minimal footer component created (web-only, optional)
- Routes configured for About page
- All information properly linked and accessible

## Mobile-First Best Practices

### ✅ DO:
1. **Place company info in Settings** - This is where users expect it
2. **Use the About page** - Provide comprehensive information when needed
3. **Keep footers minimal** - Only on web, hidden on mobile
4. **Make links clickable** - Email, phone, website should open appropriate apps
5. **Follow app patterns** - Match what users know from Instagram, TikTok, etc.

### ❌ DON'T:
1. **Don't add footers to main content pages** - Feed, Profile, Search, etc. should be clean
2. **Don't make company info prominent** - It should be discoverable but not intrusive
3. **Don't clutter the UI** - Mobile-first means clean, focused experiences
4. **Don't repeat information** - Settings is enough, About page is for details

## Usage Examples

### Accessing Company Information (User Flow):
1. User opens app
2. User navigates to Settings (from sidebar/menu)
3. User scrolls to "Support & Help" section
4. User can:
   - Click contact email/phone/website directly
   - Click "About [Company Name]" for full details
   - View social media links

### Adding Footer to Web Pages (Optional):
```tsx
import Footer from "@/components/layout/footer";

// Only on web pages, minimal footer
<div className="min-h-screen bg-background flex flex-col">
  <main className="flex-1">
    {/* Your page content */}
  </main>
  {/* Minimal footer - web only, hidden on mobile */}
  <Footer minimal={true} />
</div>
```

**Note:** Most pages (Feed, Profile, Search) should NOT have footers to maintain a clean mobile-first experience.

## Database Migration

To add the company description field to your database, run:
```bash
# The migration file has been created at:
# migrations/2025-02-03_add_company_description.sql

# Apply the migration using your database migration tool
```

## Summary

For a **professional mobile-first app** like Instagram or TikTok:
- ✅ **Settings → Support & Help** = PRIMARY location (matches user expectations)
- ✅ **About Page** = Comprehensive details when needed
- ⚠️ **Minimal Footer** = Optional, web-only, not prominent
- ❌ **No footers on main content pages** = Keep it clean and app-like

This approach provides a professional, app-like experience that scales from mobile to web while keeping company information accessible but not intrusive.
