const rateLimiter = require('../src/utils/rateLimiter');

describe('RateLimiter', () => {
  beforeEach(() => {
    rateLimiter.clear();
  });
  
  afterAll(() => {
    rateLimiter.clear();
  });
  
  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const key = 'test-key';
      const maxRequests = 5;
      const windowMs = 60000; // 1 minute
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      }
    });
    
    it('should block requests exceeding limit', () => {
      const key = 'test-key';
      const maxRequests = 3;
      const windowMs = 60000;
      
      // Make 3 requests (should all pass)
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
      }
      
      // 4th request should be blocked
      const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
    
    it('should reset after window expires', (done) => {
      const key = 'test-key';
      const maxRequests = 2;
      const windowMs = 100; // Very short window for testing
      
      // Make 2 requests
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      
      // 3rd should be blocked
      const blocked = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(blocked.allowed).toBe(false);
      
      // Wait for window to expire
      setTimeout(() => {
        const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
        done();
      }, windowMs + 50);
    }, 10000);
    
    it('should track different keys independently', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const maxRequests = 2;
      const windowMs = 60000;
      
      // Exhaust limit for key1
      rateLimiter.checkLimit(key1, maxRequests, windowMs);
      rateLimiter.checkLimit(key1, maxRequests, windowMs);
      const blocked1 = rateLimiter.checkLimit(key1, maxRequests, windowMs);
      expect(blocked1.allowed).toBe(false);
      
      // key2 should still be allowed
      const allowed2 = rateLimiter.checkLimit(key2, maxRequests, windowMs);
      expect(allowed2.allowed).toBe(true);
    });
    
    it('should return correct remaining count', () => {
      const key = 'test-key';
      const maxRequests = 5;
      const windowMs = 60000;
      
      const result1 = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(result1.remaining).toBe(4);
      
      const result2 = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(result2.remaining).toBe(3);
      
      const result3 = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(result3.remaining).toBe(2);
    });
    
    it('should return resetAt timestamp', () => {
      const key = 'test-key';
      const maxRequests = 5;
      const windowMs = 60000;
      
      const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
  
  describe('reset', () => {
    it('should reset rate limit for a key', () => {
      const key = 'test-key';
      const maxRequests = 2;
      const windowMs = 60000;
      
      // Exhaust limit
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      const blocked = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(blocked.allowed).toBe(false);
      
      // Reset
      rateLimiter.reset(key);
      
      // Should be allowed again
      const allowed = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(allowed.allowed).toBe(true);
    });
  });
  
  describe('getCount', () => {
    it('should return current request count', () => {
      const key = 'test-key';
      const windowMs = 60000;
      
      expect(rateLimiter.getCount(key, windowMs)).toBe(0);
      
      rateLimiter.checkLimit(key, 10, windowMs);
      expect(rateLimiter.getCount(key, windowMs)).toBe(1);
      
      rateLimiter.checkLimit(key, 10, windowMs);
      expect(rateLimiter.getCount(key, windowMs)).toBe(2);
    });
    
    it('should only count requests within window', (done) => {
      const key = 'test-key';
      const windowMs = 100;
      
      rateLimiter.checkLimit(key, 10, windowMs);
      rateLimiter.checkLimit(key, 10, windowMs);
      expect(rateLimiter.getCount(key, windowMs)).toBe(2);
      
      setTimeout(() => {
        // After window expires, count should be 0
        expect(rateLimiter.getCount(key, windowMs)).toBe(0);
        done();
      }, windowMs + 50);
    }, 10000);
  });
  
  describe('clear', () => {
    it('should clear all entries', () => {
      const key = 'test-key';
      const maxRequests = 2;
      const windowMs = 60000;
      
      // Exhaust limit
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      rateLimiter.checkLimit(key, maxRequests, windowMs);
      
      // Clear
      rateLimiter.clear();
      
      // Should be allowed again
      const allowed = rateLimiter.checkLimit(key, maxRequests, windowMs);
      expect(allowed.allowed).toBe(true);
    });
  });
});

