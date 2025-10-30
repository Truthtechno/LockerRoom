# Windows Setup Guide for LockerRoom

## ✅ Fixed Issues

The npm scripts have been fixed to work on Windows by:
1. Installing `cross-env` package for cross-platform environment variable handling
2. Updating `dev` and `start` scripts to use `cross-env`
3. Making the server listen configuration Windows-compatible (avoiding `reusePort` option that Windows doesn't support)

## 🚀 Getting Started

### 1. Install Dependencies

If you haven't already installed dependencies:

```bash
npm install
```

### 2. Create Environment File

Create a `.env` file in the root directory with the following variables:

```env
# Database connection (REQUIRED)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Authentication JWT Secret (REQUIRED - should be a strong random string)
JWT_SECRET=your_strong_random_secret_key_minimum_256_bits

# Cloudinary Configuration (REQUIRED for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server Configuration (Optional - defaults to 5174)
PORT=5174

# Environment (Optional - defaults to development)
NODE_ENV=development
```

### 3. Create Client Environment File

Create a `.env` file in the `client/` directory (for Vite configuration):

```env
# Cloudinary Configuration (Client-side)
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=lockerroom_upload
```

### 4. Available Commands

Now you can run any of the following commands:

```bash
# Run development server (backend)
npm run dev

# Run client development server
npm run dev:client

# Run both backend and client together
npm run dev:both

# Build for production
npm run build

# Run production server
npm start

# Database migration
npm run db:push

# Seed database
npm run seed

# Run tests
npm run test:api
npm run test:e2e

# See all available commands
npm run
```

## 📝 Notes

- The `cross-env` package has been installed to make all npm scripts work on Windows
- Make sure you have Node.js 18+ installed
- PostgreSQL connection is required (can use Neon, Supabase, or any PostgreSQL provider)
- You'll need a Cloudinary account for file uploads to work
- The server is configured to bind to `127.0.0.1` on Windows for proper IPv4 access

## 🔄 Important: Restart the Server

After the changes, you need to restart your development server:

1. **Stop** the current server (press `Ctrl + C`)
2. **Restart** with: `npm run dev`
3. **Access** the app at: `http://127.0.0.1:5174` or `http://localhost:5174`

## 🔧 Troubleshooting

### If npm run still doesn't work:

1. Make sure you're in the correct directory (LockerRoom root)
2. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
3. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

### Database Connection Issues:

- Make sure your DATABASE_URL is correct and includes `?sslmode=require` for secure connections
- Test the connection string separately if needed

### Environment Variables Not Loading:

- Make sure the `.env` file is in the root directory
- Restart your terminal after creating/editing the `.env` file
- Check that there are no trailing spaces in the `.env` file values

