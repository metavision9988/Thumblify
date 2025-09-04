const AuthService = require('../services/authService');
const { registerSchema, loginSchema } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/response');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  async register(req, res) {
    try {
      // Validate request data
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json(errorResponse(
          { message: error.details[0].message, code: 'VALIDATION_ERROR' }
        ));
      }

      // Register user
      const result = await this.authService.register(value);
      
      res.status(201).json(successResponse(result, 'User registered successfully'));
    } catch (err) {
      if (err.code === 'USER_EXISTS') {
        return res.status(409).json(errorResponse(err));
      }
      
      console.error('Registration error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async login(req, res) {
    try {
      // Validate request data
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json(errorResponse(
          { message: error.details[0].message, code: 'VALIDATION_ERROR' }
        ));
      }

      // Login user
      const result = await this.authService.login(value);
      
      res.status(200).json(successResponse(result, 'Login successful'));
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json(errorResponse(err));
      }
      
      console.error('Login error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async verify(req, res) {
    try {
      // User is already verified by auth middleware
      res.status(200).json(successResponse(
        { user: req.user }, 
        'Token is valid'
      ));
    } catch (err) {
      console.error('Token verification error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }
}

module.exports = AuthController;