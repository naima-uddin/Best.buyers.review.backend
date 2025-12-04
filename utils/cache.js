// Simple in-memory cache utility for production performance
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  // Set cache with TTL (time to live in seconds)
  set(key, value, ttl = 3600) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store value
    this.cache.set(key, value);

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
  }

  // Get cached value
  get(key) {
    return this.cache.get(key);
  }

  // Check if key exists
  has(key) {
    return this.cache.has(key);
  }

  // Delete cache entry
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  // Clear all cache
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  // Get cache size
  size() {
    return this.cache.size;
  }

  // Get cache stats
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
const cache = new MemoryCache();

// Cache middleware for Express routes
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    // Check if cached
    if (cache.has(key)) {
      const cachedData = cache.get(key);
      console.log(`✅ Cache HIT: ${req.originalUrl}`);
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode === 200 && data) {
        cache.set(key, data, duration);
        console.log(`💾 Cache SET: ${req.originalUrl} (${duration}s)`);
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = { cache, cacheMiddleware };
