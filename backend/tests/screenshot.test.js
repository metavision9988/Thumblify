const ScreenshotService = require('../src/services/screenshotService');
const { getDB } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

describe('Screenshot Service', () => {
  let screenshotService;
  let db;

  beforeAll(async () => {
    screenshotService = new ScreenshotService();
    db = getDB();
    
    // Create uploads directory for testing
    const uploadsDir = path.join(__dirname, '../uploads');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up browser instance
    if (screenshotService.browser) {
      await screenshotService.browser.close();
    }
  });

  beforeEach(async () => {
    await db.clear();
  });

  describe('Browser Management', () => {
    test('should initialize browser instance', async () => {
      await screenshotService.initializeBrowser();
      expect(screenshotService.browser).toBeDefined();
      expect(screenshotService.browser.isConnected()).toBe(true);
    });

    test('should reuse existing browser instance', async () => {
      await screenshotService.initializeBrowser();
      const firstBrowser = screenshotService.browser;
      
      await screenshotService.initializeBrowser();
      const secondBrowser = screenshotService.browser;
      
      expect(firstBrowser).toBe(secondBrowser);
    });

    test('should close browser gracefully', async () => {
      await screenshotService.initializeBrowser();
      expect(screenshotService.browser.isConnected()).toBe(true);
      
      await screenshotService.closeBrowser();
      expect(screenshotService.browser.isConnected()).toBe(false);
    });
  });

  describe('Screenshot Capture', () => {
    beforeEach(async () => {
      await screenshotService.initializeBrowser();
    });

    test('should capture screenshot from valid URL', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileSize');
      expect(result).toHaveProperty('dimensions');
      expect(result.dimensions).toHaveProperty('width');
      expect(result.dimensions).toHaveProperty('height');
      expect(result.fileSize).toBeGreaterThan(0);
      
      // Verify file exists
      const fileExists = await fs.access(result.filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    }, 30000); // 30 second timeout for network requests

    test('should capture full page screenshot', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90,
        fullPage: true
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result.dimensions.height).toBeGreaterThan(800); // Full page should be taller
    }, 30000);

    test('should handle different image formats', async () => {
      const formats = ['png', 'jpg', 'webp'];
      
      for (const format of formats) {
        const options = {
          url: 'https://example.com',
          width: 800,
          height: 600,
          format,
          quality: 80
        };

        const result = await screenshotService.captureScreenshot(options);
        expect(result.success).toBe(true);
        expect(result.filePath).toContain(`.${format}`);
      }
    }, 45000);

    test('should handle mobile viewport', async () => {
      const options = {
        url: 'https://example.com',
        width: 375,
        height: 667,
        format: 'png',
        quality: 90,
        device: 'mobile'
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result.dimensions.width).toBeLessThanOrEqual(375);
    }, 30000);

    test('should handle invalid URL', async () => {
      const options = {
        url: 'https://this-domain-should-not-exist-12345.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('failed to load');
    }, 30000);

    test('should handle timeout for slow loading pages', async () => {
      const options = {
        url: 'https://httpstat.us/200?sleep=10000', // Simulates slow response
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90,
        timeout: 5000 // 5 second timeout
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('timeout');
    }, 15000);
  });

  describe('Image Optimization', () => {
    beforeEach(async () => {
      await screenshotService.initializeBrowser();
    });

    test('should optimize image size while maintaining quality', async () => {
      const options = {
        url: 'https://example.com',
        width: 1920,
        height: 1080,
        format: 'jpg',
        quality: 85,
        optimize: true
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('optimized', true);
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('compressedSize');
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    }, 30000);

    test('should convert format during optimization', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'webp',
        quality: 80,
        optimize: true
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toContain('.webp');
    }, 30000);
  });

  describe('Job Processing Integration', () => {
    test('should process capture job and update status', async () => {
      // Create a capture job
      const job = await db.createCaptureJob({
        userId: 'test-user-id',
        type: 'url',
        source: 'https://example.com',
        status: 'pending',
        options: {
          format: 'png',
          width: 1200,
          height: 800,
          quality: 90
        }
      });

      const result = await screenshotService.processJob(job.id);
      
      expect(result.success).toBe(true);
      
      // Check that job was updated in database
      const updatedJob = await db.findCaptureJobById(job.id);
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.result).toHaveProperty('thumbnailPath');
      expect(updatedJob.result).toHaveProperty('fileSize');
      expect(updatedJob.result).toHaveProperty('dimensions');
      expect(updatedJob.processingCompletedAt).toBeDefined();
    }, 30000);

    test('should handle job processing failures', async () => {
      // Create a capture job with invalid URL
      const job = await db.createCaptureJob({
        userId: 'test-user-id',
        type: 'url',
        source: 'https://invalid-domain-12345.com',
        status: 'pending',
        options: {
          format: 'png',
          width: 1200,
          height: 800,
          quality: 90
        }
      });

      const result = await screenshotService.processJob(job.id);
      
      expect(result.success).toBe(false);
      
      // Check that job was marked as failed
      const updatedJob = await db.findCaptureJobById(job.id);
      expect(updatedJob.status).toBe('failed');
      expect(updatedJob.errorMessage).toBeDefined();
    }, 30000);
  });

  describe('File Management', () => {
    test('should clean up temporary files on failure', async () => {
      const options = {
        url: 'https://invalid-domain-12345.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      const result = await screenshotService.captureScreenshot(options);
      
      expect(result.success).toBe(false);
      
      // Should not leave any temporary files
      const uploadsDir = path.join(__dirname, '../uploads');
      const files = await fs.readdir(uploadsDir);
      const tempFiles = files.filter(file => file.startsWith('temp_'));
      expect(tempFiles).toHaveLength(0);
    }, 30000);

    test('should generate unique filenames', async () => {
      const options = {
        url: 'https://example.com',
        width: 800,
        height: 600,
        format: 'png',
        quality: 90
      };

      const result1 = await screenshotService.captureScreenshot(options);
      const result2 = await screenshotService.captureScreenshot(options);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.filePath).not.toBe(result2.filePath);
    }, 60000);
  });
});