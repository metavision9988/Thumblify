const express = require('express');
const ScreenshotService = require('../services/screenshotService');
const { captureUrlSchema } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/response');
const Joi = require('joi');

const router = express.Router();

// Create screenshot service instance
const screenshotService = new ScreenshotService();

// Extended validation schema with presets
const publicCaptureSchema = captureUrlSchema.keys({
  options: Joi.object({
    format: Joi.string()
      .valid('png', 'jpg', 'jpeg', 'webp')
      .default('png'),
    width: Joi.number()
      .integer()
      .min(100)
      .max(3840)
      .default(1200),
    height: Joi.number()
      .integer()
      .min(100)
      .max(2160)
      .default(800),
    quality: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(90),
    fullPage: Joi.boolean()
      .default(false),
    device: Joi.string()
      .valid('desktop', 'mobile', 'tablet')
      .default('desktop'),
    preset: Joi.string()
      .valid(
        // Mobile
        'mobile-portrait', 'mobile-landscape', 'iphone-14', 'iphone-14-pro', 'android-standard',
        // Tablet  
        'ipad', 'ipad-pro', 'tablet-landscape',
        // Desktop
        'desktop-hd', 'desktop-fhd', 'desktop-2k', 'desktop-4k',
        // Social Media
        'facebook-post', 'twitter-header', 'instagram-square', 'instagram-story', 'youtube-thumbnail',
        // Web Standard
        'web-banner', 'blog-header', 'thumbnail-large', 'thumbnail-medium', 'thumbnail-small',
        // Custom
        'square-large', 'square-medium', 'portrait', 'landscape'
      )
      .optional(),
    optimize: Joi.boolean()
      .default(true),
    timeout: Joi.number()
      .integer()
      .min(5000)
      .max(120000)
      .default(60000)
  }).default({})
});

// GET /public/presets - Get available resolution presets
router.get('/presets', async (req, res) => {
  try {
    const presets = screenshotService.getResolutionPresets();
    
    // Group presets by category
    const groupedPresets = {
      mobile: {},
      tablet: {},
      desktop: {},
      social: {},
      web: {},
      custom: {}
    };

    Object.entries(presets).forEach(([key, value]) => {
      if (key.startsWith('mobile-') || key.includes('iphone') || key.includes('android')) {
        groupedPresets.mobile[key] = value;
      } else if (key.startsWith('ipad') || key.startsWith('tablet-')) {
        groupedPresets.tablet[key] = value;
      } else if (key.startsWith('desktop-')) {
        groupedPresets.desktop[key] = value;
      } else if (key.includes('facebook') || key.includes('twitter') || key.includes('instagram') || key.includes('youtube')) {
        groupedPresets.social[key] = value;
      } else if (key.includes('web-') || key.includes('blog-') || key.includes('thumbnail-')) {
        groupedPresets.web[key] = value;
      } else {
        groupedPresets.custom[key] = value;
      }
    });

    res.json(successResponse({
      presets: groupedPresets,
      total: Object.keys(presets).length,
      categories: Object.keys(groupedPresets)
    }, 'Available resolution presets'));
  } catch (error) {
    console.error('Error getting presets:', error);
    res.status(500).json(errorResponse({
      message: 'Failed to get presets',
      code: 'PRESETS_ERROR'
    }));
  }
});

// POST /public/capture - Capture screenshot without authentication
router.post('/capture', async (req, res) => {
  try {
    // Validate request data
    const { error, value } = publicCaptureSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse({
        message: error.details[0].message,
        code: 'VALIDATION_ERROR'
      }));
    }

    const { url, options } = value;

    console.log(`Public capture request for: ${url}`);
    console.log('Options:', JSON.stringify(options, null, 2));

    // Capture screenshot
    const result = await screenshotService.captureScreenshot({
      url,
      ...options
    });

    if (!result.success) {
      return res.status(500).json(errorResponse({
        message: result.error || 'Screenshot capture failed',
        code: 'CAPTURE_ERROR'
      }));
    }

    // Build response
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = {
      success: true,
      url: url,
      screenshot: {
        filename: result.fileName,
        url: `${baseUrl}/uploads/${result.fileName}`,
        format: options.format,
        dimensions: {
          width: result.dimensions.width,
          height: result.dimensions.height
        },
        fileSize: result.optimizedSize || result.originalSize,
        optimized: result.optimized || false
      },
      options: options,
      timestamp: new Date().toISOString(),
      processingTime: result.processingTime
    };

    if (options.preset) {
      const presets = screenshotService.getResolutionPresets();
      response.preset = {
        name: options.preset,
        ...presets[options.preset]
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Public capture error:', error);
    res.status(500).json(errorResponse({
      message: error.message || 'Internal server error',
      code: 'INTERNAL_ERROR'
    }));
  }
});

// GET /public/status - API status without authentication
router.get('/status', (req, res) => {
  res.json(successResponse({
    service: 'Thumblify Screenshot Service',
    version: '2.0.0',
    status: 'running',
    features: [
      'Advanced JavaScript/CSS rendering',
      'Tailwind CSS support',
      'React/Vue/Angular framework support',
      '30+ resolution presets',
      'Multiple image formats (PNG, JPG, WebP)',
      'Image optimization',
      'No authentication required'
    ],
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }, 'Service status'));
});

module.exports = router;