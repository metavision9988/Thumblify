const AuthService = require('../services/authService');
const { errorResponse } = require('../utils/response');

const authService = new AuthService();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse(
        { message: 'Access denied. No token provided.', code: 'UNAUTHORIZED' }
      ));
    }

    const token = authHeader.replace('Bearer ', '');
    const result = await authService.verifyToken(token);
    
    req.user = result.user;
    next();
  } catch (error) {
    return res.status(401).json(errorResponse(error));
  }
};

module.exports = authMiddleware;