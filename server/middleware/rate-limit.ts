/**
 * Distributed Rate Limiting Middleware
 * Uses Redis for distributed rate limiting across multiple server instances
 * Falls back to in-memory rate limiting if Redis is not available
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../cache';

// In-memory fallback for when Redis is not available
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Create a rate limiting middleware
 * @param maxRequests - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Express middleware function
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting entirely in development (unless explicitly enabled)
    if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_RATE_LIMIT) {
      return next();
    }
    
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const path = req.path || req.route?.path || 'unknown';
    const rateLimitKey = `ratelimit:${key}:${path}`;
    
    // Use Redis if available, otherwise fall back to in-memory
    if (redis) {
      try {
        // Use Redis for distributed rate limiting
        const count = await redis.incr(rateLimitKey);
        
        // Set expiration on first request in the window
        if (count === 1) {
          await redis.expire(rateLimitKey, Math.floor(windowMs / 1000));
        }
        
        // Check if rate limit exceeded
        if (count > maxRequests) {
          const ttl = await redis.ttl(rateLimitKey);
          console.log(`🔐 Rate limit exceeded for IP: ${key}, path: ${path}, count: ${count}`);
          
          return res.status(429).json({ 
            error: { 
              code: "rate_limit_exceeded", 
              message: 'Too many requests, please try again later',
              retryAfter: ttl
            } 
          });
        }
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
        
        next();
      } catch (error) {
        // If Redis fails, fall back to in-memory rate limiting
        console.error('Redis rate limiting error, falling back to in-memory:', error);
        return fallbackRateLimit(key, path, maxRequests, windowMs, req, res, next);
      }
    } else {
      // No Redis available, use in-memory fallback
      return fallbackRateLimit(key, path, maxRequests, windowMs, req, res, next);
    }
  };
}

/**
 * In-memory rate limiting fallback
 */
function fallbackRateLimit(
  key: string,
  path: string,
  maxRequests: number,
  windowMs: number,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const rateLimitKey = `${key}:${path}`;
  const now = Date.now();
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetTime < now) {
        rateLimitMap.delete(k);
      }
    }
  }
  
  const entry = rateLimitMap.get(rateLimitKey);
  
  if (!entry || entry.resetTime < now) {
    // New window or expired entry
    rateLimitMap.set(rateLimitKey, {
      count: 1,
      resetTime: now + windowMs
    });
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  } else if (entry.count >= maxRequests) {
    // Rate limit exceeded
    console.log(`🔐 Rate limit exceeded (in-memory) for IP: ${key}, path: ${path}, count: ${entry.count}`);
    
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    
    return res.status(429).json({ 
      error: { 
        code: "rate_limit_exceeded", 
        message: 'Too many requests, please try again later',
        retryAfter
      } 
    });
  } else {
    // Increment count
    entry.count++;
    rateLimitMap.set(rateLimitKey, entry);
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    
    next();
  }
}

/**
 * Clear rate limit for a specific key (useful for testing or admin actions)
 */
export async function clearRateLimit(key: string, path?: string): Promise<void> {
  if (!redis) return;
  
  try {
    const rateLimitKey = path ? `ratelimit:${key}:${path}` : `ratelimit:${key}:*`;
    if (path) {
      await redis.del(rateLimitKey);
    } else {
      // Clear all rate limits for this IP
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await redis.scan(cursor, { match: rateLimitKey, count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== 0);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('Error clearing rate limit:', error);
  }
}

