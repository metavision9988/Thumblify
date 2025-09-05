require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

// Import middleware
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const captureRoutes = require('./routes/capture');
const publicRoutes = require('./routes/public');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting (apply to all routes)
app.use(generalLimiter);

// Logging middleware (only in development and production)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Uploads directory listing
app.get('/uploads', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const files = fs.readdirSync(uploadsDir).filter(file => {
      const stat = fs.statSync(path.join(uploadsDir, file));
      return stat.isFile();
    });
    
    res.json({
      success: true,
      message: 'Generated thumbnails',
      count: files.length,
      files: files.map(file => {
        const filePath = path.join(uploadsDir, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          url: `${req.protocol}://${req.get('host')}/uploads/${file}`,
          size: stat.size,
          created: stat.birthtime,
          type: path.extname(file).toLowerCase()
        };
      }).sort((a, b) => new Date(b.created) - new Date(a.created))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to read uploads directory',
      details: error.message
    });
  }
});

// Root endpoint - API documentation
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    name: 'Thumblify Pro API',
    version: '2.0.0',
    description: 'Professional thumbnail generation service with screenshot capture, image optimization, and cloud storage',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: `${baseUrl}/health`,
      public: {
        status: `GET ${baseUrl}/public/status`,
        presets: `GET ${baseUrl}/public/presets`,
        capture: `POST ${baseUrl}/public/capture`
      },
      auth: {
        register: `POST ${baseUrl}/api/v1/auth/register`,
        login: `POST ${baseUrl}/api/v1/auth/login`,
        logout: `POST ${baseUrl}/api/v1/auth/logout`,
        refresh: `POST ${baseUrl}/api/v1/auth/refresh`
      },
      capture: {
        url: `POST ${baseUrl}/api/v1/capture/url`,
        file: `POST ${baseUrl}/api/v1/capture/file`,
        jobs: `GET ${baseUrl}/api/v1/capture/jobs`,
        job_status: `GET ${baseUrl}/api/v1/capture/jobs/:id`
      },
      uploads: `${baseUrl}/uploads/`
    },
    features: [
      'Real-time screenshot capture with Puppeteer',
      'Multi-device support (Desktop/Mobile/Tablet)',
      'Image optimization with Sharp (30-50% size reduction)',
      'Multiple formats: PNG, JPG, WebP',
      'AWS S3 cloud storage integration',
      'JWT authentication system',
      'Rate limiting and security'
    ],
    usage: {
      'public_capture_no_auth': {
        method: 'POST',
        url: '/public/capture',
        description: 'Capture screenshot without authentication',
        body: {
          url: 'string (required)',
          options: {
            format: 'png|jpg|webp (default: png)',
            width: 'number (100-3840, default: 1200)',
            height: 'number (100-2160, default: 800)',
            quality: 'number (1-100, default: 90)',
            device: 'desktop|mobile|tablet (default: desktop)',
            preset: 'string (see /public/presets for options)',
            fullPage: 'boolean (default: false)',
            optimize: 'boolean (default: true)',
            timeout: 'number (5000-120000ms, default: 60000)'
          }
        }
      },
      'get_presets': {
        method: 'GET',
        url: '/public/presets',
        description: 'Get available resolution presets'
      },
      register: {
        method: 'POST',
        url: '/api/v1/auth/register',
        body: {
          username: 'string',
          email: 'string',
          password: 'string'
        }
      },
      login: {
        method: 'POST', 
        url: '/api/v1/auth/login',
        body: {
          email: 'string',
          password: 'string'
        }
      },
      'auth_capture': {
        method: 'POST',
        url: '/api/v1/capture/url',
        description: 'Capture with authentication (async job processing)',
        headers: {
          'Authorization': 'Bearer <JWT_TOKEN>',
          'Content-Type': 'application/json'
        },
        body: {
          url: 'string',
          options: {
            format: 'png|jpg|webp',
            width: 'number (default: 1200)',
            height: 'number (default: 800)',
            quality: 'number (1-100, default: 90)',
            device: 'desktop|mobile|tablet',
            fullPage: 'boolean',
            optimize: 'boolean'
          }
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '2.0.0',
    uptime: process.uptime()
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.redirect('/');
});

// Public routes (no authentication required)
app.use('/public', publicRoutes);

// API routes (authentication required)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/capture', captureRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      details: null
    },
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      details: process.env.NODE_ENV === 'production' 
        ? null 
        : error.stack
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Thumblify API server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

module.exports = app;