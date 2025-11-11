/**
 * Redis Integration for Timeline Caching and Rate Limiting
 * In-memory fallback when Redis not available
 */

import { logger } from '../middleware/error-handler';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

/**
 * Simple in-memory cache implementation (fallback when Redis unavailable)
 */
class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key) || 0;
    const newValue = current + 1;
    await this.set(key, newValue, 3600); // 1 hour default TTL
    return newValue;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export class CacheService {
  private client: MemoryCache;
  private prefix: string = 'konfam:';

  constructor() {
    // Using in-memory cache (Redis would be initialized here in production)
    this.client = new MemoryCache();
    logger.info('Cache service initialized with in-memory storage');
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.prefix + key;
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return null;
      }

      // Handle JSON serialized values
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      const fullKey = this.prefix + key;
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      await this.client.set(fullKey, serialized, ttlSeconds);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.prefix + key;
      await this.client.del(fullKey);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.prefix + key;
      return await this.client.exists(fullKey);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.prefix + pattern;
      const keys = await this.client.keys(fullPattern);
      return keys.map(k => k.replace(this.prefix, ''));
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Clear all keys matching pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      await Promise.all(keys.map(key => this.del(key)));
      logger.info(`Cleared ${keys.length} keys matching pattern: ${pattern}`);
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      const fullKey = this.prefix + key;
      return await this.client.incr(fullKey);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const key = `ratelimit:${identifier}`;
      const count = await this.incr(key);

      if (count === 1) {
        // First request, set expiry
        await this.client.set(this.prefix + key, count, windowSeconds);
      }

      const allowed = count <= maxRequests;
      const remaining = Math.max(0, maxRequests - count);
      const resetAt = new Date(Date.now() + windowSeconds * 1000);

      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error(`Rate limit check error for ${identifier}:`, error);
      return { allowed: true, remaining: maxRequests, resetAt: new Date() };
    }
  }

  /**
   * Cache timeline posts
   */
  async cacheTimeline(userId: string | undefined, posts: any[], cursor?: string): Promise<void> {
    const key = userId ? `timeline:user:${userId}` : 'timeline:global';
    await this.set(key, { posts, cursor }, 10); // 10 seconds TTL for timeline
  }

  /**
   * Get cached timeline
   */
  async getCachedTimeline(userId: string | undefined): Promise<{ posts: any[]; cursor?: string } | null> {
    const key = userId ? `timeline:user:${userId}` : 'timeline:global';
    return await this.get(key);
  }

  /**
   * Cache user profile
   */
  async cacheUser(userId: string, user: any): Promise<void> {
    await this.set(`user:${userId}`, user, 60); // 1 minute TTL
  }

  /**
   * Get cached user
   */
  async getCachedUser(userId: string): Promise<any | null> {
    return await this.get(`user:${userId}`);
  }

  /**
   * Cache post
   */
  async cachePost(postId: string, post: any): Promise<void> {
    await this.set(`post:${postId}`, post, 30); // 30 seconds TTL
  }

  /**
   * Get cached post
   */
  async getCachedPost(postId: string): Promise<any | null> {
    return await this.get(`post:${postId}`);
  }

  /**
   * Invalidate post cache
   */
  async invalidatePost(postId: string): Promise<void> {
    await this.del(`post:${postId}`);
  }

  /**
   * Cache analytics
   */
  async cacheAnalytics(crisisId: string | undefined, data: any): Promise<void> {
    const key = crisisId ? `analytics:crisis:${crisisId}` : 'analytics:global';
    await this.set(key, data, 30); // 30 seconds TTL
  }

  /**
   * Get cached analytics
   */
  async getCachedAnalytics(crisisId: string | undefined): Promise<any | null> {
    const key = crisisId ? `analytics:crisis:${crisisId}` : 'analytics:global';
    return await this.get(key);
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    await this.client.clear();
    logger.info('All caches cleared');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    keysByType: { [type: string]: number };
  }> {
    try {
      const allKeys = await this.keys('*');
      const keysByType: { [type: string]: number } = {};

      allKeys.forEach(key => {
        const type = key.split(':')[0] || 'unknown';
        keysByType[type] = (keysByType[type] || 0) + 1;
      });

      return {
        totalKeys: allKeys.length,
        keysByType,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { totalKeys: 0, keysByType: {} };
    }
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

export default getCacheService;