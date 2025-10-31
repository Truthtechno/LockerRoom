# Node.js Version Compatibility Fix

## Problem
After restarting the computer, the application fails to start with `npm run dev` due to:
1. `fetch is not defined` - Neon database requires Node 18+ for native fetch support
2. `crypto.getRandomValues is not a function` - Vite compatibility issues with Node 16

## Root Cause
The project requires **Node.js 20** (as specified in README.md), but you're currently running **Node.js 16.20.2**.

## Temporary Fix Applied
Added fetch polyfill using `node-fetch` v2 to support Node 16:
- Added polyfill in `server/index.ts` and `server/db.ts`
- Created `.nvmrc` file specifying Node 20

## Recommended Solution
**Upgrade to Node.js 20** for full compatibility:

### Option 1: Using nvm-windows (Recommended for Windows)
```powershell
# Install nvm-windows from: https://github.com/coreybutler/nvm-windows/releases
nvm install 20
nvm use 20
```

### Option 2: Manual Install
1. Download Node.js 20 LTS from https://nodejs.org/
2. Install and restart your terminal
3. Verify: `node --version` (should show v20.x.x)

### After Upgrading
```powershell
npm install  # Reinstall dependencies if needed
npm run dev  # Should work without polyfills
```

## Note
The fetch polyfill is a temporary workaround. Some dependencies still require Node 18+ and may cause issues. Upgrading to Node 20 is strongly recommended.

