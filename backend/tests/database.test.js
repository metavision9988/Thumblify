const { getDB } = require('../src/config/database');

describe('Database Models', () => {
  let db;

  beforeAll(async () => {
    db = getDB();
  });

  beforeEach(async () => {
    await db.clear();
  });

  describe('User Model', () => {
    test('should create user with required fields', async () => {
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
        planType: 'free',
        apiKey: 'api_key_123',
        createdAt: new Date().toISOString()
      };

      const user = await db.createUser(userData);
      expect(user).toHaveProperty('id', userData.id);
      expect(user).toHaveProperty('email', userData.email);
      expect(user).toHaveProperty('planType', 'free');
      expect(user).toHaveProperty('apiKey');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('isActive', true);
      expect(user).not.toHaveProperty('passwordHash');
    });

    test('should find user by email', async () => {
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
        planType: 'free',
        apiKey: 'api_key_123'
      };

      await db.createUser(userData);
      const user = await db.findUserByEmail('test@example.com');
      
      expect(user).toHaveProperty('id', userData.id);
      expect(user).toHaveProperty('email', userData.email);
      expect(user).toHaveProperty('passwordHash', userData.passwordHash);
    });

    test('should find user by API key', async () => {
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
        planType: 'free',
        apiKey: 'api_key_123'
      };

      await db.createUser(userData);
      const user = await db.findUserByApiKey('api_key_123');
      
      expect(user).toHaveProperty('id', userData.id);
      expect(user).toHaveProperty('email', userData.email);
      expect(user).toHaveProperty('apiKey', userData.apiKey);
    });

    test('should return null for non-existent user', async () => {
      const user = await db.findUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    test('should update user data', async () => {
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
        planType: 'free',
        apiKey: 'api_key_123'
      };

      await db.createUser(userData);
      
      const updatedUser = await db.updateUser('user_123', {
        planType: 'pro',
        isActive: false
      });

      expect(updatedUser).toHaveProperty('planType', 'pro');
      expect(updatedUser).toHaveProperty('isActive', false);
    });
  });

  describe('Capture Job Model', () => {
    test('should create capture job with required fields', async () => {
      const jobData = {
        id: 'job_123',
        userId: 'user_123',
        type: 'url',
        source: 'https://example.com',
        status: 'pending',
        options: {
          format: 'png',
          width: 1200,
          height: 800,
          quality: 90
        }
      };

      const job = await db.createCaptureJob(jobData);
      
      expect(job).toHaveProperty('id', jobData.id);
      expect(job).toHaveProperty('userId', jobData.userId);
      expect(job).toHaveProperty('type', 'url');
      expect(job).toHaveProperty('source', jobData.source);
      expect(job).toHaveProperty('status', 'pending');
      expect(job).toHaveProperty('options');
      expect(job.options).toHaveProperty('format', 'png');
      expect(job).toHaveProperty('createdAt');
      expect(job).toHaveProperty('updatedAt');
    });

    test('should find capture job by id', async () => {
      const jobData = {
        id: 'job_123',
        userId: 'user_123',
        type: 'url',
        source: 'https://example.com',
        status: 'pending',
        options: { format: 'png' }
      };

      await db.createCaptureJob(jobData);
      const job = await db.findCaptureJobById('job_123');
      
      expect(job).toHaveProperty('id', jobData.id);
      expect(job).toHaveProperty('userId', jobData.userId);
      expect(job).toHaveProperty('status', 'pending');
    });

    test('should find capture jobs by user id', async () => {
      const jobData1 = {
        id: 'job_123',
        userId: 'user_123',
        type: 'url',
        source: 'https://example.com',
        status: 'pending',
        options: { format: 'png' }
      };

      const jobData2 = {
        id: 'job_456',
        userId: 'user_123',
        type: 'file',
        source: 'document.pdf',
        status: 'completed',
        options: { format: 'jpg' }
      };

      await db.createCaptureJob(jobData1);
      await db.createCaptureJob(jobData2);
      
      const jobs = await db.findCaptureJobsByUserId('user_123');
      
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toHaveProperty('userId', 'user_123');
      expect(jobs[1]).toHaveProperty('userId', 'user_123');
    });

    test('should update capture job status', async () => {
      const jobData = {
        id: 'job_123',
        userId: 'user_123',
        type: 'url',
        source: 'https://example.com',
        status: 'pending',
        options: { format: 'png' }
      };

      await db.createCaptureJob(jobData);
      
      const updatedJob = await db.updateCaptureJob('job_123', {
        status: 'processing',
        processingStartedAt: new Date().toISOString()
      });

      expect(updatedJob).toHaveProperty('status', 'processing');
      expect(updatedJob).toHaveProperty('processingStartedAt');
    });

    test('should return capture jobs with pagination', async () => {
      // Create multiple jobs
      for (let i = 1; i <= 15; i++) {
        await db.createCaptureJob({
          id: `job_${i}`,
          userId: 'user_123',
          type: 'url',
          source: `https://example${i}.com`,
          status: 'completed',
          options: { format: 'png' }
        });
      }

      const result = await db.findCaptureJobsByUserId('user_123', { 
        page: 1, 
        limit: 10 
      });
      
      expect(result.jobs).toHaveLength(10);
      expect(result.totalCount).toBe(15);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(2);
      expect(result.hasNextPage).toBe(true);
    });
  });

  describe('Usage Analytics Model', () => {
    test('should create usage record', async () => {
      const usageData = {
        userId: 'user_123',
        jobId: 'job_123',
        type: 'url_capture',
        timestamp: new Date().toISOString(),
        metadata: {
          processingTime: 2500,
          outputSize: 1024000,
          format: 'png'
        }
      };

      const usage = await db.createUsageRecord(usageData);
      
      expect(usage).toHaveProperty('userId', usageData.userId);
      expect(usage).toHaveProperty('jobId', usageData.jobId);
      expect(usage).toHaveProperty('type', 'url_capture');
      expect(usage).toHaveProperty('metadata');
      expect(usage.metadata).toHaveProperty('processingTime', 2500);
    });

    test('should get usage analytics for user', async () => {
      const userId = 'user_123';
      const today = new Date().toISOString().split('T')[0];
      
      // Create multiple usage records
      for (let i = 1; i <= 5; i++) {
        await db.createUsageRecord({
          userId,
          jobId: `job_${i}`,
          type: 'url_capture',
          timestamp: new Date().toISOString()
        });
      }

      const analytics = await db.getUserUsageAnalytics(userId, {
        startDate: today,
        endDate: today
      });
      
      expect(analytics).toHaveProperty('totalJobs', 5);
      expect(analytics).toHaveProperty('jobsByType');
      expect(analytics.jobsByType).toHaveProperty('url_capture', 5);
    });
  });
});