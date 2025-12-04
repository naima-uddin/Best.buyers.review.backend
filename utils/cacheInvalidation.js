// Cache invalidation helper
const { cache } = require('./cache');

/**
 * Invalidate cache entries that match a pattern
 * @param {string} pattern - Pattern to match cache keys (supports wildcards with *)
 */
function invalidateCache(pattern) {
  const keys = Array.from(cache.cache.keys());
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  
  let count = 0;
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  });
  
  if (count > 0) {
    console.log(`🗑️  Invalidated ${count} cache entries matching: ${pattern}`);
  }
  
  return count;
}

/**
 * Middleware to invalidate cache after successful write operations
 * @param {string[]} patterns - Array of cache key patterns to invalidate
 */
function invalidateCacheMiddleware(...patterns) {
  return (req, res, next) => {
    // Store original json and send methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override to invalidate cache after successful response
    const invalidateAfterSuccess = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => invalidateCache(pattern));
      }
      return data;
    };

    res.json = (data) => {
      return originalJson(invalidateAfterSuccess(data));
    };

    res.send = (data) => {
      invalidateAfterSuccess(data);
      return originalSend(data);
    };

    next();
  };
}

module.exports = { invalidateCache, invalidateCacheMiddleware };
