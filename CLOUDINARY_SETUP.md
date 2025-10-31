# Cloudinary Setup Instructions

## Environment Variables

**IMPORTANT**: Create a `.env` file in the `client/` directory (NOT the root directory) with the following variables:

```env
# Cloudinary Configuration (Client-side)
VITE_CLOUDINARY_CLOUD_NAME=dh9cfkyhc
VITE_CLOUDINARY_UPLOAD_PRESET=lockerroom_upload
```

**File location**: `client/.env`

**After creating the file**: Restart your development server for the environment variables to take effect.

## Cloudinary Dashboard Setup

1. **Get your Cloud Name**: 
   - Go to [Cloudinary Dashboard](https://cloudinary.com/console)
   - Your cloud name is displayed at the top of the dashboard
   - Use this value for `VITE_CLOUDINARY_CLOUD_NAME` in your `client/.env` file

2. **Create Upload Preset** (REQUIRED):
   - Go to Settings → Upload → Upload Presets
   - Click "Add upload preset"
   - Configure as follows:
     - **Name**: `lockerroom_upload` (exact name required)
     - **Signing Mode**: `Unsigned` (this is crucial!)
     - **Folder**: `lockerroom` (optional, but recommended)
     - **Resource Type**: `Auto`
     - **Transformations**: Leave default
   - Click "Save"

3. **Verify Configuration**:
   - The upload preset should be visible in your upload presets list
   - Make sure it's set to "Unsigned" mode (not "Signed")
   - The folder should be set to "lockerroom"
   - Test the preset by uploading a file manually to verify it works

## Current Configuration

The application is currently configured to use:
- **Cloud Name**: `dh9cfkyhc` (from `VITE_CLOUDINARY_CLOUD_NAME`)
- **Upload Preset**: `lockerroom_upload` (from `VITE_CLOUDINARY_UPLOAD_PRESET`)
- **Folders**: 
  - Profile pictures: `lockerroom/profilePic`
  - Cover photos: `lockerroom/coverPhoto`

## Troubleshooting

### Common Issues:

1. **"Missing environment variable" error**:
   - ✅ Ensure `client/.env` file exists (NOT in root directory)
   - ✅ File should contain exactly:
     ```
     VITE_CLOUDINARY_CLOUD_NAME=dh9cfkyhc
     VITE_CLOUDINARY_UPLOAD_PRESET=lockerroom_upload
     ```
   - ✅ Restart development server after creating/editing `.env`
   - ✅ Check file location is exactly `client/.env`
   - ✅ Verify no extra spaces or quotes around values

2. **"Invalid upload preset" error**:
   - Verify preset name is exactly `lockerroom_upload`
   - Ensure preset is set to "Unsigned" mode
   - Check preset exists in Cloudinary dashboard

3. **"Network error" or "Failed to fetch"**:
   - Check internet connection
   - Verify Cloudinary cloud name is correct
   - Check browser console for detailed error logs

### Debugging Steps:

1. **Test environment variables**:
   ```javascript
   // In browser console or add to your component:
   import { testCloudinaryEnv } from '@/lib/cloudinary';
   testCloudinaryEnv();
   ```

2. **Check .env file**:
   ```bash
   # In terminal, verify the file exists and has correct content:
   cat client/.env
   ```

3. **Restart dev server**:
   ```bash
   # Stop the current server (Ctrl+C) and restart:
   npm run dev
   ```

## Testing

To test the configuration:
1. Create `client/.env` file with required variables
2. Restart development server
3. Try uploading a profile picture or cover photo
4. Check browser console for detailed logs
5. Verify that the Cloudinary URL is returned and saved to the database
