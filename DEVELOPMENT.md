# Development Guide - LockerRoom

This guide provides comprehensive information for developers working on the LockerRoom platform, including setup instructions, project structure, coding standards, and development workflows.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Database Management](#database-management)
- [API Development](#api-development)
- [Frontend Development](#frontend-development)
- [Testing](#testing)
- [Code Style & Standards](#code-style--standards)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** 18.0 or later ([Download](https://nodejs.org/))
- **PostgreSQL** 13+ or **Neon** account for serverless PostgreSQL
- **npm** 9+ or **yarn** 1.22+
- **Git** for version control

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Tailwind CSS IntelliSense
- **PostgreSQL Client** (pgAdmin, DBeaver, or psql CLI)
- **Postman** or **Insomnia** for API testing

### Accounts & Services

- **Cloudinary** account ([Sign up](https://cloudinary.com/))
- **Stripe** account (for XEN Watch payments - optional)
- **Neon** account (for serverless PostgreSQL - recommended)
- **Redis** (Upstash serverless recommended) - Optional, for caching and rate limiting
- **Sentry** account - Optional, for error monitoring and performance tracking

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/Truthtechno/LockerRoom.git
cd LockerRoom
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=development
PORT=5174
CLIENT_ORIGIN=http://localhost:5173

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/lockerroom

# JWT Authentication
JWT_SECRET=your-secure-jwt-secret-key-minimum-32-characters

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Stripe Payments (Optional)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Session Storage
SESSION_SECRET=your-session-secret-key

# Redis Caching (Optional - improves performance significantly)
REDIS_URL=https://your-redis-url.upstash.io
REDIS_TOKEN=your-redis-token

# Sentry Error Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Rate Limiting (Optional - enables rate limiting in development)
ENABLE_RATE_LIMIT=false
```

### 4. Redis Setup (Optional but Recommended)

Redis caching significantly improves performance by reducing database load. The system works without Redis but with reduced performance.

#### Option A: Upstash Redis (Recommended - Serverless)

1. **Create Account** at [upstash.com](https://upstash.com)
2. **Create Redis Database**
3. **Copy Connection Details**:
   - `REDIS_URL` - Your Redis REST URL
   - `REDIS_TOKEN` - Your Redis REST token
4. **Add to `.env`**:
   ```env
   REDIS_URL=https://your-redis-url.upstash.io
   REDIS_TOKEN=your-redis-token
   ```

#### Option B: Local Redis (Development)

1. **Install Redis**:
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Windows
   # Download from https://redis.io/download
   # Or use WSL: wsl --install, then apt install redis
   
   # Linux
   sudo apt install redis-server
   sudo systemctl start redis
   ```

2. **Add to `.env`**:
   ```env
   REDIS_URL=redis://localhost:6379
   ```

#### Option C: Skip Redis (Not Recommended)

The system will work without Redis but with reduced performance:
- No caching (higher database load)
- In-memory rate limiting only (doesn't work across multiple servers)
- Slower response times

### 5. Sentry Setup (Optional)

Sentry provides error monitoring and performance tracking:

1. **Create Account** at [sentry.io](https://sentry.io)
2. **Create New Project** (Node.js)
3. **Copy DSN** from project settings
4. **Add to `.env`**:
   ```env
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   ```

### 6. Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database
createdb lockerroom

# Push schema
npm run db:push

# Seed with demo data
npm run seed
```

#### Option B: Neon Serverless (Recommended)

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string to `DATABASE_URL` in `.env`
4. Run migrations:

```bash
npm run db:push
npm run seed
```

### 7. Start Development Server

```bash
# Start both frontend and backend concurrently
npm run dev:both

# Or start separately:
npm run dev        # Backend on port 5174
npm run dev:client # Frontend on port 5173
```

### 8. Test Phase 1 Optimizations

```bash
# Run comprehensive test suite for Phase 1 optimizations
npm run test:phase1

# This tests:
# - Redis caching functionality (with graceful fallback)
# - Rate limiting middleware
# - Sentry integration
# - Streaming uploads verification
# - Cache integration in routes
```

**Note**: The test suite will pass even if Redis/Sentry are not configured, as these are optional optimizations with graceful fallbacks.

## Project Structure

```
lockerroom/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   │   ├── admin/     # Admin portal pages
│   │   │   ├── profile/   # Profile pages
│   │   │   └── xen-watch/ # XEN Watch pages
│   │   ├── components/    # Reusable components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   ├── posts/     # Post-related components
│   │   │   └── admin/     # Admin components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── main.tsx       # Application entry point
│   └── index.html
│
├── server/                 # Backend Express application
│   ├── routes/            # API route handlers
│   │   ├── admin.ts       # Admin routes
│   │   ├── posts.ts       # Post routes
│   │   ├── school-admin.ts # School admin routes
│   │   ├── system-admin.ts # System admin routes
│   │   ├── xen-watch.ts   # XEN Watch routes
│   │   └── ...
│   ├── middleware/        # Express middleware
│   │   └── auth.ts        # Authentication middleware
│   ├── db.ts              # Database connection
│   ├── storage.ts         # Database operations
│   ├── auth-storage.ts    # Auth-related operations
│   └── index.ts           # Server entry point
│
├── shared/                 # Shared code between frontend/backend
│   ├── schema.ts          # Drizzle schema definitions
│   └── types/             # TypeScript type definitions
│
├── migrations/             # Database migration files
├── scripts/                # Utility scripts
│   ├── seed.ts            # Database seeding
│   └── ...
│
├── tests/                  # Test files
│   ├── api/               # API integration tests
│   ├── e2e/               # End-to-end tests
│   └── fixtures/          # Test data and fixtures
│
├── docs/                   # Documentation
├── dist/                   # Build output
├── package.json
├── tsconfig.json
├── vite.config.ts
└── drizzle.config.ts
```

## Development Workflow

### Starting Development

1. **Start Database** (if using local PostgreSQL)
   ```bash
   # macOS/Linux
   brew services start postgresql
   
   # Or using Docker
   docker-compose up -d postgres
   ```

2. **Start Development Server**
   ```bash
   npm run dev:both
   ```

3. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5174/api

### Making Changes

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding standards (see below)
   - Write tests for new features
   - Update documentation as needed

3. **Test Locally**
   ```bash
   npm run test:api      # Run API tests
   npm run test:e2e      # Run E2E tests
   npm run check         # Type check
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Database Management

### Schema Changes

1. **Modify Schema** in `shared/schema.ts`
2. **Generate Migration**
   ```bash
   npm run db:push
   ```
   This will automatically create and apply migrations.

3. **For Manual Migrations**
   Create migration files in `migrations/` directory following the naming convention:
   ```
   YYYY-MM-DD_description.sql
   ```

### Seeding Data

```bash
# Seed with demo data
npm run seed

# Reset and reseed
npm run reseed

# Safe seed (preserves existing data)
npm run safe-seed
```

### Database Queries

Use Drizzle ORM for all database operations:

```typescript
import { db } from '../db';
import { users, posts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

// Query example
const userPosts = await db
  .select()
  .from(posts)
  .where(eq(posts.studentId, studentId))
  .orderBy(desc(posts.createdAt));
```

## API Development

### Creating New API Routes

1. **Define Route Handler** in appropriate file under `server/routes/`

```typescript
// server/routes/posts.ts
export function registerPostRoutes(app: Express) {
  app.get('/api/posts/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getPostWithDetails(id);
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  });
}
```

2. **Register Route** in `server/routes.ts`

```typescript
import { registerPostRoutes } from './routes/posts';
registerPostRoutes(app);
```

### Authentication Middleware

```typescript
import { requireAuth, requireRole } from './middleware/auth';

// Require authentication
app.get('/api/protected', requireAuth, handler);

// Require specific role
app.get('/api/admin', requireAuth, requireRole('system_admin'), handler);
```

### Error Handling

Use consistent error response format:

```typescript
res.status(400).json({
  error: {
    code: 'validation_error',
    message: 'Required field missing'
  }
});
```

### Input Validation

Use Zod schemas for validation:

```typescript
import { z } from 'zod';

const createPostSchema = z.object({
  caption: z.string().min(1).max(1000),
  studentId: z.string().uuid(),
});

app.post('/api/posts', requireAuth, async (req, res) => {
  try {
    const data = createPostSchema.parse(req.body);
    // Process data...
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});
```

## Frontend Development

### Creating New Pages

1. **Create Page Component** in `client/src/pages/`

```typescript
// client/src/pages/my-page.tsx
import { useRoute } from 'wouter';

export default function MyPage() {
  const [match] = useRoute('/my-page');
  if (!match) return null;
  
  return (
    <div>
      <h1>My Page</h1>
    </div>
  );
}
```

2. **Add Route** in `client/src/App.tsx`

```typescript
import MyPage from './pages/my-page';

<Route path="/my-page" component={MyPage} />
```

### Using React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Query example
const { data, isLoading } = useQuery({
  queryKey: ['posts', postId],
  queryFn: () => fetch(`/api/posts/${postId}`).then(r => r.json())
});

// Mutation example
const mutation = useMutation({
  mutationFn: (newPost) => 
    fetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify(newPost)
    }),
  onSuccess: () => {
    queryClient.invalidateQueries(['posts']);
  }
});
```

### Component Structure

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h2>{title}</h2>
      <Button onClick={() => setCount(count + 1)}>
        Count: {count}
      </Button>
    </div>
  );
}
```

## Testing

### API Tests

Located in `tests/api/`:

```typescript
// tests/api/posts.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('POST /api/posts', () => {
  it('should create a post', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'Test post', studentId: '...' });
    
    expect(response.status).toBe(200);
  });
});
```

Run tests:
```bash
npm run test:api
```

### E2E Tests

Using Playwright in `tests/e2e/`:

```typescript
// tests/e2e/posts.spec.ts
import { test, expect } from '@playwright/test';

test('user can create post', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'student@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  
  await page.goto('/create');
  // Test post creation...
});
```

Run tests:
```bash
npm run test:e2e
npm run test:e2e:ui  # With UI
```

## Code Style & Standards

### TypeScript

- Use TypeScript strictly - avoid `any` types
- Define interfaces for all props and data structures
- Use type inference where possible
- Prefer `interface` over `type` for object shapes

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Functions**: camelCase (`getUserData()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Files**: kebab-case for pages, PascalCase for components
- **API Routes**: kebab-case (`/api/user-profiles`)

### Code Organization

- **One component per file**
- **Group related imports**: external → internal → relative
- **Export default** for pages, **named exports** for utilities
- **Keep components under 300 lines** - split if larger

### Git Commit Messages

Follow conventional commits:

```
feat: add user profile page
fix: resolve login authentication issue
docs: update API documentation
style: format code with prettier
refactor: reorganize components structure
test: add tests for post creation
chore: update dependencies
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string
psql $DATABASE_URL
```

#### Port Already in Use

```bash
# Find process using port
lsof -i :5174  # macOS/Linux
netstat -ano | findstr :5174  # Windows

# Kill process or change PORT in .env
```

#### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors

```bash
# Check types
npm run check

# Clean build
rm -rf dist
npm run build
```

### Debug Mode

Enable debug logging:

```env
DEBUG=*
NODE_ENV=development
```

### Database Debugging

```typescript
// Enable query logging in db.ts
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool, {
  logger: process.env.NODE_ENV === 'development'
});
```

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

## Getting Help

- Check existing documentation in `/docs`
- Search GitHub issues
- Ask in team chat/slack
- Create a new issue with detailed description

---

**Happy Coding! 🚀**

