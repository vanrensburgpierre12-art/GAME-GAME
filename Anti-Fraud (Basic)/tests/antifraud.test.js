const { checkBuyAttempt, recordBuyAttempt, rateLimiter, buyAttemptTracker } = require('../src/index');

describe('Anti-Fraud Module', () => {
  beforeEach(() => {
    rateLimiter.clear();
    buyAttemptTracker.clear();
  });
  
  afterAll(() => {
    rateLimiter.clear();
    buyAttemptTracker.clear();
  });
  
  describe('checkBuyAttempt', () => {
    const mockUser = {
      id: 'user-123',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    };
    
    const mockParcel = {
      parcel_id: 'parcel-456',
    };
    
    it('should allow buy attempt when all checks pass', () => {
      const result = checkBuyAttempt(mockUser, mockParcel);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
    
    it('should block when rate limit exceeded', () => {
      const maxAttempts = 2;
      
      // Exhaust rate limit
      for (let i = 0; i < maxAttempts; i++) {
        checkBuyAttempt(mockUser, mockParcel, { maxBuyAttemptsPerMinute: maxAttempts });
      }
      
      // Next attempt should be blocked
      const result = checkBuyAttempt(mockUser, mockParcel, { maxBuyAttemptsPerMinute: maxAttempts });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });
    
    it('should block rapid repeated buy attempts for same parcel', () => {
      const cooldownMs = 100;
      
      // First attempt should pass
      const result1 = checkBuyAttempt(mockUser, mockParcel, { buyCooldownMs: cooldownMs });
      expect(result1.allowed).toBe(true);
      
      // Record the attempt
      recordBuyAttempt(mockUser.id, mockParcel.parcel_id);
      
      // Immediate second attempt should be blocked
      const result2 = checkBuyAttempt(mockUser, mockParcel, { buyCooldownMs: cooldownMs });
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('Too many buy attempts');
    });
    
    it('should allow buy attempts for different parcels', () => {
      const parcel1 = { parcel_id: 'parcel-1' };
      const parcel2 = { parcel_id: 'parcel-2' };
      const cooldownMs = 100;
      
      // Buy parcel 1
      const result1 = checkBuyAttempt(mockUser, parcel1, { buyCooldownMs: cooldownMs });
      expect(result1.allowed).toBe(true);
      recordBuyAttempt(mockUser.id, parcel1.parcel_id);
      
      // Should be able to buy parcel 2 immediately
      const result2 = checkBuyAttempt(mockUser, parcel2, { buyCooldownMs: cooldownMs });
      expect(result2.allowed).toBe(true);
    });
    
    it('should enforce new user caps', () => {
      const newUser = {
        id: 'new-user',
        created_at: new Date().toISOString(), // Just created
      };
      
      const maxBuys = 2;
      const parcel = { parcel_id: 'parcel-1' };
      
      // First buy should pass
      const result1 = checkBuyAttempt(newUser, parcel, { 
        newUserMaxBuys: maxBuys,
        newUserWindowMs: 86400000, // 24 hours
      });
      expect(result1.allowed).toBe(true);
      recordBuyAttempt(newUser.id, parcel.parcel_id);
      
      // Second buy should pass
      const result2 = checkBuyAttempt(newUser, parcel, { 
        newUserMaxBuys: maxBuys,
        newUserWindowMs: 86400000,
      });
      expect(result2.allowed).toBe(true);
      recordBuyAttempt(newUser.id, parcel.parcel_id);
      
      // Third buy should be blocked (exceeds max)
      const result3 = checkBuyAttempt(newUser, parcel, { 
        newUserMaxBuys: maxBuys,
        newUserWindowMs: 86400000,
      });
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('New user limit');
    });
    
    it('should not enforce new user caps for old users', () => {
      const oldUser = {
        id: 'old-user',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      };
      
      const parcel = { parcel_id: 'parcel-1' };
      
      // Should be able to make multiple attempts (within rate limit)
      for (let i = 0; i < 5; i++) {
        const result = checkBuyAttempt(oldUser, parcel, { 
          newUserMaxBuys: 2,
          newUserWindowMs: 86400000,
        });
        // Should pass (only rate limit would block, but we're not hitting that)
        expect(result.allowed).toBe(true);
        recordBuyAttempt(oldUser.id, parcel.parcel_id);
      }
    });
  });
  
  describe('recordBuyAttempt', () => {
    it('should record buy attempts', () => {
      const userId = 'user-123';
      const parcelId = 'parcel-456';
      
      recordBuyAttempt(userId, parcelId);
      
      const count = buyAttemptTracker.getAttemptCount(userId, parcelId, 60000);
      expect(count).toBe(1);
    });
  });
});

