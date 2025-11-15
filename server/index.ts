// Polyfill fetch for Node 16 compatibility
if (typeof globalThis.fetch === 'undefined') {
  await (async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch.default || nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
  })();
}

// Initialize Sentry error monitoring (must be before other imports)
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    debug: process.env.NODE_ENV === 'development',
  });
  console.log('✅ Sentry error monitoring initialized');
} else {
  console.log('⚠️ Sentry not configured (SENTRY_DSN not set) - error monitoring disabled');
}

import express, { type Request, Response, NextFunction } from "express";
import "dotenv/config";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureSysAdmin } from "./ensure-sysadmin";
import { ensureAdminsTable, backfillAdminsFromUsers } from "../scripts/ensure-admins-table";
import { notifyExpiringSubscriptions, deactivateExpiredSubscriptions } from "./utils/notification-helpers";

const app = express();

// Sentry will automatically capture errors via Express integration
// No explicit middleware needed - Sentry hooks into Express automatically

// Security middleware with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for dev
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  // Disable HSTS in development to avoid browsers force-upgrading http to https on :5174
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Additional security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  next();
});

// Response compression
app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Cache headers for static assets
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  } else if (req.path.startsWith('/api/')) {
    // API responses - short cache
    res.setHeader('Cache-Control', 'private, max-age=60'); // 1 minute
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Ensure admins table exists and backfill existing admins
  try {
    await ensureAdminsTable();
    await backfillAdminsFromUsers();
  } catch (error) {
    console.warn(`⚠️ Failed to ensure admins table: ${error instanceof Error ? error.message : String(error)}`);
    // Continue server startup even if this fails
  }

  // Ensure system admin user exists
  await ensureSysAdmin();

  // Sentry error handler is already set up via setupExpressErrorHandler

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error to Sentry if configured
    if (process.env.SENTRY_DSN && status >= 500) {
      Sentry.captureException(err);
    }

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5174 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5174', 10);
  
  // Windows-compatible listen configuration
  const isWindows = process.platform === 'win32';
  const listenConfig = isWindows 
    ? { port, host: "127.0.0.1" as const }
    : { port, host: "0.0.0.0" as const, reusePort: true };
  
  server.listen(listenConfig, () => {
    log(`serving on port ${port}`);
    
    // Schedule subscription checks
    // Check every 6 hours for expiring subscriptions and expired subscriptions
    setInterval(async () => {
      try {
        await notifyExpiringSubscriptions();
        await deactivateExpiredSubscriptions();
      } catch (error) {
        console.error('Error in scheduled subscription checks:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    // Run immediately on startup (after a short delay to ensure DB is ready)
    setTimeout(async () => {
      try {
        await notifyExpiringSubscriptions();
        await deactivateExpiredSubscriptions();
      } catch (error) {
        console.error('Error in initial subscription checks:', error);
      }
    }, 30000); // 30 seconds delay
  });

  // Handle server errors, especially port already in use
  server.on('error', async (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use.`);
      
      // Try to find the process using the port on Windows
      if (isWindows) {
        try {
          const { execSync } = await import('child_process');
          const netstatOutput = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
          const pidMatch = netstatOutput.match(/\s+(\d+)\s*$/m);
          if (pidMatch) {
            const pid = pidMatch[1];
            console.error(`\n🔍 Found process ${pid} using port ${port}`);
            console.error(`💡 To kill it, run: taskkill /PID ${pid} /F`);
          }
        } catch (e) {
          // If we can't find the process, that's okay - just continue with generic message
        }
      }
      
      console.error(`\n💡 To fix this, try one of the following:`);
      console.error(`   1. Kill the process using the port:`);
      if (isWindows) {
        console.error(`      netstat -ano | findstr :${port}`);
        console.error(`      taskkill /PID <PID> /F`);
      } else {
        console.error(`      lsof -ti :${port} | xargs kill -9`);
      }
      console.error(`   2. Use a different port: PORT=5175 npm run dev`);
      console.error(`   3. Wait a few seconds for the port to be released\n`);
      process.exit(1);
    } else {
      console.error(`\n❌ Server error: ${err.message}\n`);
      throw err;
    }
  });
})();
