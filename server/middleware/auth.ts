import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, Role } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type AppRole = Role;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  
  console.log('🔐 Auth middleware:', { 
    hasToken: !!token, 
    tokenLength: token.length,
    url: req.url,
    method: req.method
  });
  
  if (!token) return res.status(401).json({ error: { code: 'auth_required', message: 'Authentication required' } });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    console.log('🔐 JWT payload:', { 
      hasId: !!payload.id, 
      id: payload.id, 
      email: payload.email,
      role: payload.role,
      schoolId: payload.schoolId,
      linkedId: payload.linkedId,
      keys: Object.keys(payload)
    });
    
    // Validate that linkedId is present in JWT payload for roles that require it
    const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
    if (rolesRequiringLinkedId.includes(payload.role) && !payload.linkedId) {
      console.error('🔐 JWT payload missing linkedId for role that requires it:', { 
        jwtId: payload.id, 
        jwtEmail: payload.email,
        jwtRole: payload.role,
        jwtSchoolId: payload.schoolId
      });
      return res.status(401).json({ 
        error: { 
          code: 'missing_linkedId', 
          message: 'User does not have a linked profile record' 
        } 
      });
    }
    
    // Create normalized payload with JWT data (no database query needed)
    const normalizedPayload = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      schoolId: payload.schoolId || null,
      linkedId: payload.linkedId // This is the linked_id from JWT
    };
    
    console.log('🔐 Final normalized payload:', { 
      id: normalizedPayload.id, 
      email: normalizedPayload.email,
      role: normalizedPayload.role, 
      schoolId: normalizedPayload.schoolId,
      linkedId: normalizedPayload.linkedId
    });
    
    (req as any).auth = normalizedPayload; // { id, email, role, schoolId, linkedId }
    req.user = normalizedPayload; // Also set req.user for consistency
    next();
  } catch (error) {
    console.log('🔐 JWT verification failed:', error);
    return res.status(401).json({ error: { code: 'invalid_token', message: 'Invalid token' } });
  }
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).auth?.role as AppRole | undefined;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Insufficient permissions' } });
    }
    next();
  };
}

// “Self” or “ownership” guard – compare URL param to caller’s identity
export function requireSelfByParam(paramName: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const callerUserId = (req as any).auth?.id;
    const target = req.params[paramName];

    if (!callerUserId || !target) {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Missing target id' } });
    }
    if (callerUserId !== target) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Not your resource' } });
    }
    next();
  };
}

// Example for school ownership if route includes :schoolId
export function requireSchoolOwnership(paramName: string = 'schoolId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).auth?.role as AppRole | undefined;
    const callerSchoolId = (req as any).auth?.schoolId;
    const targetSchoolId = req.params[paramName];

    if (role !== 'school_admin' || !callerSchoolId || callerSchoolId !== targetSchoolId) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'School ownership required' } });
    }
    next();
  };
}

// XEN Watch RBAC helpers
export function isScoutAdmin(user: any): boolean {
  return user?.role === 'scout_admin';
}

export function isXenScout(user: any): boolean {
  return user?.role === 'xen_scout';
}

export function requireScoutAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).auth;
  if (!isScoutAdmin(user)) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Scout Admin access required' } });
  }
  next();
}

export function requireScoutOrAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).auth;
  if (!isScoutAdmin(user) && !isXenScout(user)) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Scout access required' } });
  }
  next();
}

export function requireSystemAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).auth;
  if (user?.role !== 'system_admin') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'System Admin access required' } });
  }
  next();
}

// New RBAC helper function - system_admin can bypass all checks
export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).auth?.role as Role | undefined;
    if (!role) {
      return res.status(401).json({ error: { code: "unauthorized", message: "No role found" } });
    }
    // system_admin always has full rights - can bypass all checks
    if (role === "system_admin") {
      return next();
    }
    if (allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({ error: { code: "forbidden", message: "Insufficient permissions" } });
  };
}