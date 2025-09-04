const request = require('supertest');
const app = require('../src/app');
const { getDB } = require('../src/config/database');

describe('Capture Endpoints', () => {
  let db;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.BCRYPT_ROUNDS = '4';
    db = getDB();
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

  describe('POST /api/v1/capture/url', () => {
    test('should create URL capture job with valid data', async () => {
      const captureData = {
        url: 'https://example.com',
        options: {
          format: 'png',
          width: 1200,
          height: 800,
          quality: 90,
          fullPage: false
        }
      };

      const response = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data).toHaveProperty('url', captureData.url);
      expect(response.body.data.options).toMatchObject(captureData.options);
    });

    test('should reject URL capture without authentication', async () => {
      const captureData = {
        url: 'https://example.com',
        options: { format: 'png' }
      };

      const response = await request(app)
        .post('/api/v1/capture/url')
        .send(captureData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should reject invalid URL format', async () => {
      const captureData = {
        url: 'invalid-url',
        options: { format: 'png' }
      };

      const response = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject internal network URLs', async () => {
      const captureData = {
        url: 'http://127.0.0.1:8080/admin',
        options: { format: 'png' }
      };

      const response = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('UNSAFE_URL');
    });

    test('should apply default options when not provided', async () => {
      const captureData = {
        url: 'https://example.com'
      };

      const response = await request(app)
        .post('/api/v1/capture/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(captureData)
        .expect(201);

      expect(response.body.data.options).toMatchObject({
        format: 'png',
        width: 1200,
        height: 800,
        quality: 90,
        fullPage: false
      });
    });
  });

  describe('GET /api/v1/capture/jobs', () => {
    test('should return user capture jobs', async () => {
      // Create some test jobs
      await db.createCaptureJob({
        userId: userId,
        type: 'url',
        source: 'https://example1.com',
        status: 'completed',
        options: { format: 'png' }
      });

      await db.createCaptureJob({
        userId: userId,
        type: 'url', 
        source: 'https://example2.com',
        status: 'pending',
        options: { format: 'jpg' }
      });

      const response = await request(app)
        .get('/api/v1/capture/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.jobs).toHaveLength(2);
      expect(response.body.data).toHaveProperty('totalCount', 2);
      expect(response.body.data).toHaveProperty('currentPage', 1);
    });

    test('should return paginated results', async () => {
      // Create 15 test jobs
      for (let i = 1; i <= 15; i++) {
        await db.createCaptureJob({
          userId: userId,
          type: 'url',
          source: `https://example${i}.com`,
          status: 'completed',
          options: { format: 'png' }
        });
      }

      const response = await request(app)
        .get('/api/v1/capture/jobs?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.jobs).toHaveLength(10);
      expect(response.body.data.totalCount).toBe(15);
      expect(response.body.data.currentPage).toBe(1);
      expect(response.body.data.totalPages).toBe(2);
      expect(response.body.data.hasNextPage).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/capture/jobs')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/capture/jobs/:jobId', () => {
    test('should return specific job details', async () => {
      const job = await db.createCaptureJob({
        userId: userId,
        type: 'url',
        source: 'https://example.com',
        status: 'completed',
        options: { format: 'png' },
        result: {
          thumbnailUrl: 'https://storage.example.com/thumb123.png',
          originalSize: { width: 1920, height: 1080 },
          thumbnailSize: { width: 1200, height: 800 },
          fileSize: 245760
        }
      });

      const response = await request(app)
        .get(`/api/v1/capture/jobs/${job.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', job.id);
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data.result).toHaveProperty('thumbnailUrl');
    });

    test('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/v1/capture/jobs/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });

    test('should not allow access to other users jobs', async () => {
      // Create another user
      const otherUserData = {
        email: 'other@example.com',
        password: 'Password123'
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUserData);

      const otherUserId = otherUserResponse.body.data.user.id;

      // Create job for other user
      const otherUserJob = await db.createCaptureJob({
        userId: otherUserId,
        type: 'url',
        source: 'https://private-example.com',
        status: 'completed',
        options: { format: 'png' }
      });

      // Try to access with current user's token
      const response = await request(app)
        .get(`/api/v1/capture/jobs/${otherUserJob.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('DELETE /api/v1/capture/jobs/:jobId', () => {
    test('should delete user job', async () => {
      const job = await db.createCaptureJob({
        userId: userId,
        type: 'url',
        source: 'https://example.com',
        status: 'completed',
        options: { format: 'png' }
      });

      const response = await request(app)
        .delete(`/api/v1/capture/jobs/${job.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('deleted');

      // Verify job is deleted
      const deletedJob = await db.findCaptureJobById(job.id);
      expect(deletedJob).toBeNull();
    });

    test('should not allow deleting other users jobs', async () => {
      // Create another user and their job
      const otherUserData = {
        email: 'other@example.com',
        password: 'Password123'
      };

      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(otherUserData);

      const otherUserId = otherUserResponse.body.data.user.id;

      const otherUserJob = await db.createCaptureJob({
        userId: otherUserId,
        type: 'url',
        source: 'https://private-example.com',
        status: 'completed',
        options: { format: 'png' }
      });

      // Try to delete with current user's token
      const response = await request(app)
        .delete(`/api/v1/capture/jobs/${otherUserJob.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });
});