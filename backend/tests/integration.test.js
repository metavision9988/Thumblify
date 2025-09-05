const request = require('supertest');
const app = require('../src/app');
const { getDB } = require('../src/config/database');
const ScreenshotService = require('../src/services/screenshotService');

describe('Integration Tests - Screenshot Processing', () => {
  let db;
  let authToken;
  let userId;
  let screenshotService;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.BCRYPT_ROUNDS = '4';
    db = getDB();
    screenshotService = new ScreenshotService();
  });

  afterAll(async () => {
    // Clean up browser
    if (screenshotService) {
      await screenshotService.cleanup();
    }
  });

  beforeEach(async () => {
    // Clear database and create test user with token
    await db.clear();
    
    const userData = {
      email: 'test@example.com',
      password: 'Password123'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);
    
    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  describe('Manual Job Processing', () => {
    test('should process job manually via API endpoint', async () => {
      // Create a capture job
      const captureData = {
        url: 'https://httpbin.org/html', // Simple HTML endpoint
        options: {
          format: 'png',
          width: 800,
          height: 600,
          quality: 90
        }
      };

      // Create job
      const createResponse = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(201);

      const jobId = createResponse.body.data.jobId;
      
      // Process the job manually
      const processResponse = await request(app)
        .post(`/api/v1/capture/jobs/${jobId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(processResponse.body).toHaveProperty('success', true);
      expect(processResponse.body.data).toHaveProperty('thumbnailPath');
      expect(processResponse.body.data).toHaveProperty('fileName');
      expect(processResponse.body.data).toHaveProperty('fileSize');
      expect(processResponse.body.data.fileSize).toBeGreaterThan(0);

      // Verify job was updated in database
      const updatedJob = await db.findCaptureJobById(jobId);
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.result).toBeDefined();
      expect(updatedJob.result.thumbnailPath).toBeDefined();
      expect(updatedJob.processingCompletedAt).toBeDefined();
    }, 60000); // 60 second timeout

    test('should handle processing failure gracefully', async () => {
      // Create a capture job with invalid URL
      const captureData = {
        url: 'https://this-domain-definitely-does-not-exist-12345.com',
        options: {
          format: 'png',
          width: 800,
          height: 600,
          quality: 90
        }
      };

      // Create job
      const createResponse = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(201);

      const jobId = createResponse.body.data.jobId;
      
      // Process the job manually (should fail)
      const processResponse = await request(app)
        .post(`/api/v1/capture/jobs/${jobId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(processResponse.body).toHaveProperty('success', false);
      expect(processResponse.body.error).toBeDefined();

      // Verify job was marked as failed
      const failedJob = await db.findCaptureJobById(jobId);
      expect(failedJob.status).toBe('failed');
      expect(failedJob.errorMessage).toBeDefined();
    }, 60000);

    test('should not allow processing other users jobs', async () => {
      // Create another user
      const otherUserData = {
        email: 'other@example.com',
        password: 'Password123'
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUserData);

      const otherUserId = otherUserResponse.body.data.user.id;

      // Create job for other user directly in database
      const otherUserJob = await db.createCaptureJob({
        userId: otherUserId,
        type: 'url',
        source: 'https://httpbin.org/html',
        status: 'pending',
        options: { format: 'png' }
      });

      // Try to process other user's job
      const processResponse = await request(app)
        .post(`/api/v1/capture/jobs/${otherUserJob.id}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(processResponse.body).toHaveProperty('success', false);
      expect(processResponse.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('Direct Screenshot Service', () => {
    test('should capture screenshot directly', async () => {
      const options = {
        url: 'https://httpbin.org/html',
        width: 800,
        height: 600,
        format: 'png',
        quality: 90,
        optimize: false // Skip optimization for faster test
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.dimensions).toHaveProperty('width');
      expect(result.dimensions).toHaveProperty('height');
      expect(result.fileName).toMatch(/\.png$/);
    }, 45000);

    test('should optimize images when requested', async () => {
      const options = {
        url: 'https://httpbin.org/html',
        width: 1200,
        height: 800,
        format: 'jpg',
        quality: 70,
        optimize: true
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result.optimized).toBe(true);
      expect(result.originalSize).toBeDefined();
      expect(result.compressedSize).toBeDefined();
      expect(result.compressedSize).toBeLessThanOrEqual(result.originalSize);
    }, 45000);
  });

  describe('Job Workflow', () => {
    test('should complete full workflow from job creation to processing', async () => {
      // Step 1: Create job
      const captureData = {
        url: 'https://httpbin.org/html',
        options: {
          format: 'webp',
          width: 600,
          height: 400,
          quality: 85
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(201);

      const jobId = createResponse.body.data.jobId;
      
      // Step 2: Verify job is pending
      const pendingResponse = await request(app)
        .get(`/api/v1/capture/jobs/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(pendingResponse.body.data.status).toBe('pending');
      
      // Step 3: Process job
      await request(app)
        .post(`/api/v1/capture/jobs/${jobId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Step 4: Verify job is completed
      const completedResponse = await request(app)
        .get(`/api/v1/capture/jobs/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(completedResponse.body.data.status).toBe('completed');
      expect(completedResponse.body.data.result).toBeDefined();
      expect(completedResponse.body.data.result.thumbnailUrl).toBeDefined();
      expect(completedResponse.body.data.result.format).toBe('webp');

      // Step 5: Verify usage analytics
      const analyticsResponse = await request(app)
        .get('/api/v1/capture/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.totalJobs).toBe(1);
      expect(analyticsResponse.body.data.jobsByType.url_capture).toBe(1);
    }, 60000);
  });
});