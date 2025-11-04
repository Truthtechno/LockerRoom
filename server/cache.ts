/**
 * Redis Cache Module
 * Provides caching functionality with Upstash Redis (serverless Redis)
 * Falls back gracefully if Redis is not configured
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (optional - will be null if REDIS_URL not set)
export const redis = process.env.REDIS_URL 
  ? new Redis({ 
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN 
    })
  : null;

// Log Redis connection status
if (redis) {
  console.log('✅ Redis cache initialized');
} else {
  console.log('⚠️ Redis cache not configured (REDIS_URL not set) - caching disabled');
}

/**
 * Generic cache get function with TTL
 * @param key - Cache key
 * @param fetchFn - Function to fetch data if not cached
 * @param ttl - Time to live in seconds (default: 5 minutes)
 * @returns Cached data or freshly fetched data
 */
export async function cacheGet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  if (!redis) {
    // No Redis configured, just fetch directly
    return fetchFn();
  }
  
  try {
    // Try to get from cache
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Cache miss, fetch data
    const data = await fetchFn();
    
    // Store in cache with TTL
    await redis.setex(key, ttl, data);
    
    return data;
  } catch (error) {
    // If Redis fails, fall back to direct fetch
    console.error('Redis cache error:', error);
    return fetchFn();
  }
}

/**
 * Invalidate a cache key
 * @param key - Cache key to invalidate
 */
export async function cacheInvalidate(key: string): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.del(key);
  } catch (error) {
    console.error('Redis cache invalidation error:', error);
  }
}

/**
 * Invalidate multiple cache keys matching a pattern
 * @param pattern - Pattern to match (e.g., 'user:*' or 'feed:*')
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  
  try {
    // Upstash Redis uses SCAN for pattern matching
    const keys: string[] = [];
    let cursor = 0;
    
    do {
      const result = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis cache pattern invalidation error:', error);
  }
}

/**
 * Set a cache value directly
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number = 300
): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.setex(key, ttl, value);
  } catch (error) {
    console.error('Redis cache set error:', error);
  }
}

/**
 * Get a cache value directly
 * @param key - Cache key
 * @returns Cached value or null
 */
export async function cacheGetDirect<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  
  try {
    return await redis.get<T>(key);
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
}

/**
 * Check if a key exists in cache
 * @param key - Cache key
 * @returns True if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (!redis) return false;
  
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    console.error('Redis cache exists error:', error);
    return false;
  }
}

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export async function getCacheStats(): Promise<{
  enabled: boolean;
  connected: boolean;
}> {
  if (!redis) {
    return { enabled: false, connected: false };
  }
  
  try {
    // Simple ping to check connection
    await redis.ping();
    return { enabled: true, connected: true };
  } catch (error) {
    return { enabled: true, connected: false };
  }
}

