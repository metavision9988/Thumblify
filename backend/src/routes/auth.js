const express = require('express');
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const authController = new AuthController();

// Public routes (with auth rate limiting)
router.post('/register', authLimiter, (req, res) => authController.register(req, res));
router.post('/login', authLimiter, (req, res) => authController.login(req, res));

// Protected routes
router.get('/verify', authMiddleware, (req, res) => authController.verify(req, res));

module.exports = router;