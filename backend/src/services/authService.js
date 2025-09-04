const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

class AuthService {
  constructor() {
    this.db = getDB();
  }

  async register(userData) {
    const { email, password } = userData;

    // Check if user already exists
    const existingUser = await this.db.findUserByEmail(email);
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.code = 'USER_EXISTS';
      throw error;
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.db.createUser({
      email,
      passwordHash,
      planType: 'free',
      monthlyQuota: 100,
      usedQuota: 0,
      apiKey: null
    });

    // Generate JWT token
    const token = this.generateToken(user);

    // Remove password from response
    const { passwordHash: _, ...userResponse } = user;

    return {
      user: userResponse,
      token
    };
  }

  async login(credentials) {
    const { email, password } = credentials;

    // Find user by email
    const user = await this.db.findUserByEmail(email);
    if (!user) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Generate JWT token
    const token = this.generateToken(user);

    // Remove password from response
    const { passwordHash: _, ...userResponse } = user;

    return {
      user: userResponse,
      token
    };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await this.db.findUserById(decoded.userId);
      
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      // Remove password from response
      const { passwordHash: _, ...userResponse } = user;
      return { user: userResponse };
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        const error = new Error('Invalid token');
        error.code = 'INVALID_TOKEN';
        throw error;
      }
      if (err.name === 'TokenExpiredError') {
        const error = new Error('Token expired');
        error.code = 'TOKEN_EXPIRED';
        throw error;
      }
      throw err;
    }
  }

  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      planType: user.planType
    };

    const options = {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);
  }
}

module.exports = AuthService;