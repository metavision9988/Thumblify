const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { getDB } = require('../src/config/database');

describe('Authentication System', () => {
  let db;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.BCRYPT_ROUNDS = '4'; // Faster for tests
    db = getDB();
  });

  beforeEach(async () => {
    // Clear database before each test
    await db.clear();
  });

  afterAll(async () => {
    // Cleanup
    if (global.testServer) {
      await global.testServer.close();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      
      // Verify JWT token
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email', userData.email);
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('valid email');
    });

    test('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('Password');
    });

    test('should reject registration with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      // First registration should succeed
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    test('should login with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      // First register a user
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Then login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      
      // Verify JWT token
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
    });

    test('should reject login with invalid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(userData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });
  });

  describe('JWT Token Validation', () => {
    test('should validate valid JWT token', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      // Register and get token
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      const token = registerResponse.body.data.token;

      const response = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(userData.email);
    });

    test('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('Invalid token');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/verify')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.message).toContain('Access denied');
    });
  });
});