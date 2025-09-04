// Standardized API response utilities

const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

const errorResponse = (error, statusCode = 400) => ({
  success: false,
  error: {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message,
    details: error.details || null
  },
  timestamp: new Date().toISOString()
});

module.exports = {
  successResponse,
  errorResponse
};