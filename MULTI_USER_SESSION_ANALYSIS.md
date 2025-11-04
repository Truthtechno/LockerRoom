# Multi-User/Role Session Support - Comprehensive Analysis

## Executive Summary

The current LockerRoom system is designed with a **single-user, single-role authentication model**. To enable simultaneous login as multiple users/roles (e.g., observing real-time student submissions as a scout while managing reviews as a scout admin), significant architectural changes are required.

**Current State**: One token stored in `localStorage`, one user context, one React Query cache.

**Desired State**: Multiple tokens, multiple user contexts, isolated caches per session, unified UI for managing active sessions.

---

## ⚠️ Important Clarification: Different Browsers vs Same Browser

### Different Browsers (Chrome vs Firefox) - ✅ Should Work
If you're logging in as **System Admin in Chrome** and **School Admin in Firefox**, these should work independently because:
- Each browser has its own isolated `localStorage`
- Each browser has its own isolated `sessionStorage`
- No shared state between browsers
- **This should already work with current system**

### Same Browser, Different Tabs - ⚠️ Currently Has Issues
If you're logging in as **System Admin in Tab 1** and **School Admin in Tab 2** of the same browser:
- Both tabs share the same `localStorage`
- The `storage` event listener in `use-auth.ts` (line 59) causes cross-tab interference
- When you log in in Tab 2, Tab 1 detects the `localStorage` change and may refresh/logout
- **This is the issue you're experiencing**

---

## Current Architecture Analysis

### 1. Authentication & Token Management

**Location**: `client/src/lib/auth.ts`, `server/middleware/auth.ts`

**Current Implementation**:
- Single JWT token stored in `localStorage.getItem("token")`
- Token contains: `{ id, email, role, schoolId, linkedId }`
- Login replaces previous token (lines 47-48 in `auth.ts`)
- Logout clears single token (lines 122-165 in `auth.ts`)
- No support for multiple concurrent sessions

**Problem**: 
```typescript
// Current: Single token storage
localStorage.setItem("token", token);  // ❌ Overwrites previous token

// API requests always use single token
const token = localStorage.getItem("token");  // ❌ Only one token available
```

### 2. API Request Layer

**Location**: `client/src/lib/queryClient.ts`

**Current Implementation**:
- `apiRequest()` always reads from `localStorage.getItem('token')` (line 51)
- `getQueryFn()` also uses single token (line 91)
- All fetch requests use single Authorization header
- No context/selector for which token to use

**Problem**:
```typescript
// Current: Hard-coded single token
export async function apiRequest(...) {
  const token = localStorage.getItem('token');  // ❌ Single source
  headers["Authorization"] = `Bearer ${token}`;
}
```

### 3. React Query Cache

**Location**: `client/src/lib/queryClient.ts`

**Current Implementation**:
- Global `QueryClient` instance (line 117)
- Cache is shared across all components
- Login clears entire cache (line 40 in `auth.ts`)
- No isolation between user sessions

**Problem**:
```typescript
// Current: Global cache
export const queryClient = new QueryClient({ ... });  // ❌ Shared cache

// Login clears everything
queryClient.clear();  // ❌ Destroys all cached data
```

### 4. User State Management

**Location**: `client/src/hooks/use-auth.ts`

**Current Implementation**:
- Single `user` state in `useAuth()` hook
- Single `isLoading` state
- Single `isAuthenticated` check
- No support for multiple users

**Problem**:
```typescript
// Current: Single user state
const [user, setUser] = useState<AuthUser | null>(null);  // ❌ One user only

return {
  user,  // ❌ Only one user
  isLoading,
  isAuthenticated: !!user,
};
```

### 5. Real-Time Updates

**Current Implementation**:
- Polling-based: `refetchInterval: 5000` (XEN Watch submissions)
- `refetchInterval: 60000` (notifications)
- `refetchInterval: 30000` (analytics, scout admin dashboard)
- No WebSocket or Server-Sent Events (SSE)
- Each query polls independently

**Implications for Multi-Session**:
- Multiple sessions would each poll independently (not a blocker)
- But each session needs its own query context with correct auth token

### 6. Component-Level Token Usage

**Location**: Multiple files across the codebase

**Current Implementation**:
- Many components directly call `localStorage.getItem('token')`
- Found in: `system-admin.tsx`, `manage-schools.tsx`, `live-reports.tsx`, etc.
- Inconsistent usage: some use `apiRequest()`, others use direct `fetch()`

**Problem**:
- Hard to refactor without touching every component
- No abstraction layer for token management

---

## Requirements for Multi-User/Role Sessions

### Functional Requirements

1. **Multiple Concurrent Sessions**
   - User can be logged in as Student + Scout + Scout Admin simultaneously
   - Each session maintains independent authentication state
   - Each session has its own React Query cache

2. **Session Management UI**
   - Display active sessions in UI (tab bar, sidebar, or header)
   - Switch between sessions easily
   - Log out individual sessions
   - Visual indicator of which session is "active"

3. **Real-Time Updates Per Session**
   - Student session sees new XEN Watch submissions in real-time
   - Scout session sees new submissions for review in real-time
   - Scout Admin session sees all reviews coming in real-time
   - Each session's queries use the correct authentication token

4. **Context-Aware API Requests**
   - API requests automatically use the correct token for the active session
   - Or explicitly specify which session to use for a request
   - React Query queries are tagged with session ID

5. **Isolated State**
   - React Query cache isolated per session
   - No data leakage between sessions
   - Clean logout of one session doesn't affect others

### Non-Functional Requirements

1. **Performance**
   - Multiple sessions shouldn't significantly impact performance
   - Efficient cache management
   - Minimize redundant API calls

2. **Security**
   - Tokens stored securely (consider encrypted storage)
   - Clear session boundaries
   - Proper token validation on backend

3. **User Experience**
   - Smooth switching between sessions
   - Clear visual feedback
   - No confusion about which session is active

---

## Proposed Solution Architecture

### Option 1: Multi-Context with Token Manager (Recommended)

**Core Concept**: Create a session manager that maintains multiple tokens and provides context-aware access.

#### Architecture Components

1. **Session Manager** (`client/src/lib/session-manager.ts`)
   ```typescript
   interface ActiveSession {
     id: string;           // Unique session ID
     userId: string;
     user: AuthUser;
     token: string;
     role: string;
     createdAt: number;
     lastActive: number;
   }

   class SessionManager {
     private sessions: Map<string, ActiveSession> = new Map();
     private activeSessionId: string | null = null;

     addSession(user: AuthUser, token: string): string;
     removeSession(sessionId: string): void;
     switchSession(sessionId: string): void;
     getActiveSession(): ActiveSession | null;
     getAllSessions(): ActiveSession[];
   }
   ```

2. **Multi-Context React Hook** (`client/src/hooks/use-multi-auth.ts`)
   ```typescript
   interface MultiAuthContext {
     activeSession: ActiveSession | null;
     allSessions: ActiveSession[];
     switchSession: (sessionId: string) => void;
     addSession: (email: string, password: string) => Promise<void>;
     removeSession: (sessionId: string) => void;
     isActive: (sessionId: string) => boolean;
   }

   export function useMultiAuth(): MultiAuthContext;
   ```

3. **Context-Aware API Request** (`client/src/lib/api-client.ts`)
   ```typescript
   export async function apiRequest(
     method: string,
     url: string,
     data?: unknown,
     options?: {
       sessionId?: string;  // Optional: use specific session
       useActiveSession?: boolean;  // Default: true
     }
   ): Promise<Response> {
     const sessionManager = SessionManager.getInstance();
     const session = options?.sessionId 
       ? sessionManager.getSession(options.sessionId)
       : sessionManager.getActiveSession();
     
     const token = session?.token;
     // ... make request with token
   }
   ```

4. **Per-Session Query Client** (`client/src/lib/multi-query-client.ts`)
   ```typescript
   class MultiQueryClient {
     private clients: Map<string, QueryClient> = new Map();

     getClient(sessionId: string): QueryClient {
       if (!this.clients.has(sessionId)) {
         this.clients.set(sessionId, new QueryClient({ ... }));
       }
       return this.clients.get(sessionId)!;
     }

     getActiveClient(): QueryClient {
       const sessionId = SessionManager.getInstance().getActiveSessionId();
       return this.getClient(sessionId || 'default');
     }

     clearSession(sessionId: string): void {
       const client = this.clients.get(sessionId);
       if (client) {
         client.clear();
         this.clients.delete(sessionId);
       }
     }
   }
   ```

5. **Session Switcher UI Component** (`client/src/components/session-switcher.tsx`)
   ```typescript
   export function SessionSwitcher() {
     const { activeSession, allSessions, switchSession, removeSession } = useMultiAuth();
     
     return (
       <div className="session-switcher">
         {allSessions.map(session => (
           <SessionTab 
             key={session.id}
             session={session}
             isActive={session.id === activeSession?.id}
             onSwitch={() => switchSession(session.id)}
             onRemove={() => removeSession(session.id)}
           />
         ))}
         <AddSessionButton />
       </div>
     );
   }
   ```

#### Storage Strategy

**Option A: localStorage with Namespacing**
```typescript
// Store sessions as JSON array
localStorage.setItem('sessions', JSON.stringify([
  { id: 's1', userId: 'u1', token: 't1', user: {...}, ... },
  { id: 's2', userId: 'u2', token: 't2', user: {...}, ... }
]));

localStorage.setItem('activeSessionId', 's1');
```

**Option B: IndexedDB (Better for Multiple Tokens)**
- More secure
- Can store more data
- Better performance for frequent access
- Recommended for production

**Option C: Encrypted Storage**
- Use `crypto.subtle` for encryption
- Tokens encrypted at rest
- More secure but more complex

### Option 2: Browser Tabs Approach (Simpler but Limited)

**Concept**: Use separate browser tabs/windows for each session.

**Pros**:
- Minimal code changes
- Natural isolation (separate browser contexts)
- Each tab has its own localStorage

**Cons**:
- Not true multi-session in single UI
- Can't easily observe interactions between roles
- Poor UX for the use case (observing real-time updates)

**Verdict**: ❌ Not suitable for the requirement

### Option 3: Virtual Sessions with Proxy Pattern

**Concept**: Maintain virtual session contexts, proxy all requests.

**Pros**:
- Clean separation
- Flexible
- Can add/remove sessions dynamically

**Cons**:
- More complex implementation
- Requires significant refactoring

**Verdict**: ✅ Viable but more complex than Option 1

---

## Detailed Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Create Session Manager
- **File**: `client/src/lib/session-manager.ts`
- **Tasks**:
  - Implement `SessionManager` class
  - Add session CRUD operations
  - Implement persistence (localStorage/IndexedDB)
  - Add session switching logic
  - Add session validation (check token expiry)

#### 1.2 Update Storage Layer
- **Files**: `client/src/lib/storage.ts` (new), update `auth.ts`
- **Tasks**:
  - Create storage abstraction for sessions
  - Migrate from single token to session array
  - Implement encryption for tokens (optional but recommended)
  - Handle migration from old single-token format

#### 1.3 Create Multi-Auth Hook
- **File**: `client/src/hooks/use-multi-auth.ts`
- **Tasks**:
  - Create React context for multi-auth
  - Implement `useMultiAuth()` hook
  - Provide session switching functionality
  - Handle session state updates

### Phase 2: API Layer Updates (Week 1-2)

#### 2.1 Context-Aware API Request
- **File**: `client/src/lib/api-client.ts` (refactor `queryClient.ts`)
- **Tasks**:
  - Update `apiRequest()` to accept session context
  - Update `getQueryFn()` to use session token
  - Add session ID to query keys where appropriate
  - Ensure backward compatibility during migration

#### 2.2 Multi-Query Client
- **File**: `client/src/lib/multi-query-client.ts`
- **Tasks**:
  - Create `MultiQueryClient` class
  - Implement per-session QueryClient instances
  - Add cache isolation
  - Handle session switch cache updates

#### 2.3 Update Existing API Calls
- **Files**: All files using `apiRequest()` or `fetch()`
- **Tasks**:
  - Audit all API calls
  - Update to use context-aware version
  - Add session context where needed
  - Test thoroughly

### Phase 3: UI Components (Week 2)

#### 3.1 Session Switcher Component
- **File**: `client/src/components/session-switcher.tsx`
- **Tasks**:
  - Create tab-based or dropdown UI
  - Show active session indicator
  - Add "Add Session" button
  - Add session removal functionality
  - Show session metadata (role, name, avatar)

#### 3.2 Session Management Modal
- **File**: `client/src/components/session-manager-modal.tsx`
- **Tasks**:
  - Login form for adding new session
  - List of all active sessions
  - Session details (role, login time, last active)
  - Remove session button

#### 3.3 Update Layout Components
- **Files**: `client/src/components/navigation/sidebar.tsx`, `App.tsx`
- **Tasks**:
  - Integrate session switcher into UI
  - Update user display to show active session
  - Add visual indicators for session context

### Phase 4: Component Updates (Week 2-3)

#### 4.1 Update Auth-Dependent Components
- **Files**: All pages using `useAuth()`
- **Tasks**:
  - Replace `useAuth()` with `useMultiAuth()` where needed
  - Update to use active session context
  - Test each page with multiple sessions

#### 4.2 Update Real-Time Components
- **Files**: 
  - `client/src/pages/xen-watch/index.tsx`
  - `client/src/pages/scouts/admin/index.tsx`
  - `client/src/pages/notifications.tsx`
- **Tasks**:
  - Ensure queries use correct session token
  - Verify real-time updates work per session
  - Test cross-session interactions

### Phase 5: Backend Considerations (Week 3)

#### 5.1 Token Validation
- **File**: `server/middleware/auth.ts`
- **Tasks**:
  - Verify no changes needed (JWT validation is stateless)
  - Ensure token expiry handling works correctly
  - Test multiple tokens from same user

#### 5.2 Rate Limiting
- **File**: `server/middleware/rate-limit.ts` (if exists)
- **Tasks**:
  - Ensure rate limiting is per-token, not per-IP
  - Adjust limits if needed for multi-session use case

#### 5.3 Session Tracking (Optional)
- **File**: `server/routes/auth.ts`
- **Tasks**:
  - Optional: Track active sessions in database
  - Optional: Add endpoint to list active sessions
  - Optional: Add endpoint to revoke specific sessions

### Phase 6: Testing & Migration (Week 3-4)

#### 6.1 Unit Tests
- Test SessionManager class
- Test MultiQueryClient
- Test API request routing

#### 6.2 Integration Tests
- Test login/logout with multiple sessions
- Test session switching
- Test real-time updates across sessions

#### 6.3 Migration Path
- Create migration script for existing users
- Convert single token to first session
- Handle edge cases

---

## Key Challenges & Solutions

### Challenge 1: React Query Cache Isolation

**Problem**: React Query uses global cache, but we need per-session caches.

**Solution**: 
- Create multiple `QueryClient` instances
- One per session
- Switch active client when switching sessions
- Clear client when session is removed

**Implementation**:
```typescript
const sessionQueryClients = new Map<string, QueryClient>();

function getQueryClientForSession(sessionId: string): QueryClient {
  if (!sessionQueryClients.has(sessionId)) {
    sessionQueryClients.set(sessionId, new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: (context) => {
            // Use session-specific token
            const session = sessionManager.getSession(sessionId);
            return getQueryFn({ sessionToken: session.token })(context);
          }
        }
      }
    }));
  }
  return sessionQueryClients.get(sessionId)!;
}
```

### Challenge 2: Component Re-rendering on Session Switch

**Problem**: When switching sessions, all components need to re-render with new data.

**Solution**:
- Use React Context for active session
- Trigger query invalidation on session switch
- Use React Query's `queryClient.invalidateQueries()` strategically

**Implementation**:
```typescript
function switchSession(sessionId: string) {
  const oldClient = getQueryClientForSession(activeSessionId);
  activeSessionId = sessionId;
  const newClient = getQueryClientForSession(sessionId);
  
  // Optionally: Invalidate all queries to force refresh
  newClient.invalidateQueries();
  
  // Trigger re-render
  setActiveSessionId(sessionId);
}
```

### Challenge 3: Token Storage Security

**Problem**: Storing multiple JWT tokens in localStorage is a security risk.

**Solution**:
- Use IndexedDB instead of localStorage (more secure)
- Optionally encrypt tokens at rest
- Implement token rotation
- Add session expiry

**Implementation**:
```typescript
// Use IndexedDB with encryption
import { openDB } from 'idb';

const db = await openDB('sessions', 1, {
  upgrade(db) {
    const store = db.createObjectStore('sessions', { keyPath: 'id' });
    store.createIndex('userId', 'userId');
  }
});

// Encrypt token before storing
const encryptedToken = await encrypt(token, encryptionKey);
await db.put('sessions', { id: sessionId, token: encryptedToken, ... });
```

### Challenge 4: Backward Compatibility

**Problem**: Existing code expects single token in `localStorage.getItem('token')`.

**Solution**:
- Create abstraction layer
- Maintain backward compatibility during migration
- Gradual migration path

**Implementation**:
```typescript
// Temporary compatibility layer
export function getToken(): string | null {
  if (isMultiSessionEnabled()) {
    const session = sessionManager.getActiveSession();
    return session?.token || null;
  }
  // Fallback to old behavior
  return localStorage.getItem('token');
}

// Update gradually
// OLD: localStorage.getItem('token')
// NEW: getToken() or sessionManager.getActiveSession()?.token
```

### Challenge 5: Real-Time Updates Per Session

**Problem**: Each session needs independent polling/updates.

**Solution**:
- Each session's QueryClient has its own refetch intervals
- Queries are tagged with session ID
- No cross-contamination

**Implementation**:
```typescript
// Each session's queries are independent
useQuery({
  queryKey: ['/api/xen-watch/submissions', sessionId],
  queryFn: () => apiRequest('GET', '/api/xen-watch/submissions/me', undefined, { sessionId }),
  refetchInterval: 5000,  // Each session polls independently
});
```

---

## Migration Strategy

### Phase A: Preparation (No Breaking Changes)
1. Create new files alongside old ones
2. Add feature flag: `ENABLE_MULTI_SESSION`
3. Implement SessionManager but don't use it yet
4. Test in isolation

### Phase B: Parallel Implementation
1. Keep old `auth.ts` working
2. Add new multi-session code
3. Allow users to opt-in via feature flag
4. Test both paths

### Phase C: Migration
1. Convert existing single session to multi-session format
2. Default to multi-session mode
3. Maintain fallback for edge cases

### Phase D: Cleanup
1. Remove old single-session code
2. Remove feature flag
3. Update documentation

---

## Estimated Effort

### Development Time
- **Phase 1 (Core Infrastructure)**: 3-5 days
- **Phase 2 (API Layer)**: 3-4 days
- **Phase 3 (UI Components)**: 2-3 days
- **Phase 4 (Component Updates)**: 4-5 days
- **Phase 5 (Backend)**: 1-2 days
- **Phase 6 (Testing)**: 3-4 days

**Total**: ~3-4 weeks of development time

### Testing Time
- Unit tests: 2-3 days
- Integration tests: 3-4 days
- Manual QA: 3-4 days

**Total Testing**: ~2 weeks

### Documentation
- Technical documentation: 2-3 days
- User guide: 1-2 days

---

## Risks & Mitigations

### Risk 1: Performance Degradation
**Impact**: High
**Probability**: Medium
**Mitigation**: 
- Use IndexedDB for efficient storage
- Lazy-load QueryClients
- Monitor performance metrics

### Risk 2: Security Issues
**Impact**: Critical
**Probability**: Medium
**Mitigation**:
- Encrypt tokens at rest
- Implement session expiry
- Add token rotation
- Security audit

### Risk 3: Breaking Changes
**Impact**: High
**Probability**: Low
**Mitigation**:
- Feature flag for gradual rollout
- Comprehensive testing
- Backward compatibility layer

### Risk 4: Complexity Increase
**Impact**: Medium
**Probability**: High
**Mitigation**:
- Clear documentation
- Code comments
- Architecture diagrams
- Team training

---

## Alternative: Simpler Approach (If Time-Constrained)

### Quick Win: Browser Profile Approach
**Concept**: Use browser profiles or incognito windows for different roles.

**Pros**:
- Zero code changes
- Complete isolation
- Can be done immediately

**Cons**:
- Poor UX (multiple windows)
- Can't easily observe interactions
- Not true multi-session in single UI

**Verdict**: ✅ Good for testing, ❌ Not for production use case

### Quick Win: Role Switching (Not True Multi-Session)
**Concept**: Allow user to "switch roles" by logging out and back in, but remember credentials.

**Pros**:
- Simpler implementation
- Faster to build
- Less risky

**Cons**:
- Not simultaneous sessions
- Can't observe real-time across roles
- Doesn't meet requirement

**Verdict**: ❌ Doesn't solve the problem

---

## Recommendations

### Recommended Approach: **Option 1 (Multi-Context with Token Manager)**

**Why**:
1. Meets all requirements
2. Scalable architecture
3. Good user experience
4. Maintainable long-term

### Implementation Priority:
1. **High Priority**: Core infrastructure (SessionManager, storage)
2. **High Priority**: API layer updates (context-aware requests)
3. **Medium Priority**: UI components (session switcher)
4. **Medium Priority**: Component updates (migration)
5. **Low Priority**: Backend enhancements (session tracking)

### Phased Rollout:
1. **Phase 1**: Internal testing with feature flag
2. **Phase 2**: Beta release to select users
3. **Phase 3**: General availability

---

## Questions to Address Before Implementation

1. **Storage Preference**: localStorage vs IndexedDB vs Encrypted Storage?
2. **UI Placement**: Where should session switcher appear? (Header, Sidebar, Floating?)
3. **Session Limits**: Maximum number of concurrent sessions?
4. **Session Expiry**: How long should sessions remain active?
5. **Feature Flag**: Enable for all users or opt-in?
6. **Backward Compatibility**: How long to maintain old single-session code?

---

## Next Steps

1. **Review this document** with team
2. **Answer questions** above
3. **Approve approach** and timeline
4. **Create detailed tickets** for each phase
5. **Begin Phase 1** implementation

---

## Appendix: Code Structure Preview

```
client/src/
├── lib/
│   ├── session-manager.ts          # NEW: Core session management
│   ├── session-storage.ts          # NEW: Storage abstraction
│   ├── multi-query-client.ts       # NEW: Per-session QueryClients
│   ├── api-client.ts               # MODIFY: Context-aware API requests
│   └── auth.ts                     # MODIFY: Support multi-session
├── hooks/
│   ├── use-multi-auth.ts           # NEW: Multi-session hook
│   └── use-auth.ts                 # MODIFY: Optional compatibility wrapper
├── components/
│   ├── session-switcher.tsx        # NEW: Session switching UI
│   └── session-manager-modal.tsx   # NEW: Add/remove sessions
└── contexts/
    └── MultiAuthContext.tsx        # NEW: React context for sessions
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Author**: System Analysis
**Status**: Ready for Review

### Quick Fix for Same-Browser, Different-Tabs Use Case

If you need to test with different accounts in different tabs of the same browser, you can temporarily disable the cross-tab storage listener:

**Temporary Fix**: Comment out the storage event listener in `use-auth.ts`:

```typescript
// TEMPORARY: Disable cross-tab storage listener for development
// window.addEventListener('storage', handleStorageChange);
```

**Note**: This will disable cross-tab synchronization, but allows you to have different accounts in different tabs for development.

### Better Fix: Make Storage Listener Smarter

For a more permanent solution that works in development, we can modify the storage listener to only react to changes from the same user, not different users:

**Better Fix**: Update `use-auth.ts` to ignore storage changes from different users:

```typescript
const handleStorageChange = async (e: StorageEvent) => {
  // Only react to storage changes if they're from the same user
  if (e.key === 'token' || e.key === 'auth_user') {
    const newToken = localStorage.getItem('token');
    const newUserStr = localStorage.getItem('auth_user');
    
    // Check if the change is from a different user
    if (newUserStr) {
      try {
        const newUser = JSON.parse(newUserStr);
        const currentUser = user;
        
        // If different user ID, don't refresh (allow multiple users in different tabs)
        if (currentUser && newUser.id !== currentUser.id) {
          console.log('Storage change detected from different user, ignoring...');
          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    await fetchUser();
  }
};
```

**For Production**: Different browsers (Chrome vs Firefox) should work fine without any changes since they have completely isolated storage.
