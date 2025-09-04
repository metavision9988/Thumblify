const express = require('express');
const CaptureController = require('../controllers/captureController');
const authMiddleware = require('../middleware/auth');
const { captureLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const captureController = new CaptureController();

// Protected routes (require authentication and have capture rate limiting)
router.post('/url', authMiddleware, captureLimiter, (req, res) => 
  captureController.captureUrl(req, res)
);

router.get('/jobs', authMiddleware, (req, res) => 
  captureController.getJobs(req, res)
);

router.get('/jobs/:jobId', authMiddleware, (req, res) => 
  captureController.getJobById(req, res)
);

router.delete('/jobs/:jobId', authMiddleware, (req, res) => 
  captureController.deleteJob(req, res)
);

router.get('/analytics', authMiddleware, (req, res) => 
  captureController.getUsageAnalytics(req, res)
);

module.exports = router;