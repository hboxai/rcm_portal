import logger from '../utils/logger.js';

/**
 * Simple in-memory cache with TTL support
 * Can be replaced with Redis for production multi-instance deployments
 * 
 * Features:
 * - TTL (Time To Live) for automatic expiration
 * - LRU-like eviction when max size is reached
 * - Cache-aside pattern support
 * - Namespace support for organized caching
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number; // in seconds
  cleanupInterval?: number; // in ms
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes default
    
    // Start cleanup interval
    const cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Update access time for LRU
    entry.accessedAt = Date.now();
    this.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    // Evict if at max size
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const ttl = ttlSeconds ?? this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
      accessedAt: Date.now(),
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern (prefix)
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Cache-aside pattern: Get from cache, or fetch and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }
    
    // Fetch and cache
    logger.debug({ key }, 'Cache miss, fetching');
    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug({ key: oldestKey }, 'Evicted LRU cache entry');
    }
  }

  /**
   * Clean up expired entries
   */
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
      logger.debug({ cleaned }, 'Cleaned up expired cache entries');
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Create cache instances for different purposes
export const userCache = new MemoryCache({
  maxSize: 500,
  defaultTTL: 300, // 5 minutes
});

export const queryCache = new MemoryCache({
  maxSize: 1000,
  defaultTTL: 60, // 1 minute for query results
});

export const sessionCache = new MemoryCache({
  maxSize: 1000,
  defaultTTL: 900, // 15 minutes for sessions
});

// Cache key generators
export const CacheKeys = {
  user: (id: number) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  userList: (page: number, limit: number) => `users:list:${page}:${limit}`,
  claimSearch: (query: string) => `claims:search:${query}`,
  uploadsList: (userId: number, page: number) => `uploads:${userId}:${page}`,
};

// Helper functions for common operations
export async function getCachedUser(userId: number, fetchFn: () => Promise<any>) {
  return userCache.getOrSet(CacheKeys.user(userId), fetchFn, 300);
}

export function invalidateUserCache(userId: number) {
  userCache.delete(CacheKeys.user(userId));
}

export function invalidateAllUserCaches() {
  userCache.deletePattern('user:');
}

export default {
  userCache,
  queryCache,
  sessionCache,
  CacheKeys,
  getCachedUser,
  invalidateUserCache,
  invalidateAllUserCaches,
};
