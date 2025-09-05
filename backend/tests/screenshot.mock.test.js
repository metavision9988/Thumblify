const ScreenshotService = require('../src/services/screenshotService');
const { getDB } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

// Mock puppeteer for unit testing
jest.mock('puppeteer');
const puppeteer = require('puppeteer');

describe('Screenshot Service (Mocked)', () => {
  let screenshotService;
  let db;
  let mockBrowser;
  let mockPage;

  beforeAll(async () => {
    screenshotService = new ScreenshotService();
    db = getDB();
  });

  beforeEach(async () => {
    await db.clear();
    
    // Setup mocks
    mockPage = {
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    };

    puppeteer.launch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Browser Management (Mocked)', () => {
    test('should initialize browser with correct options', async () => {
      await screenshotService.initializeBrowser();

      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: 'new',
        args: expect.arrayContaining([
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]),
        defaultViewport: null,
        timeout: 30000
      });

      expect(screenshotService.browser).toBe(mockBrowser);
    });

    test('should reuse existing browser instance', async () => {
      await screenshotService.initializeBrowser();
      await screenshotService.initializeBrowser();

      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Screenshot Capture (Mocked)', () => {
    beforeEach(async () => {
      // Mock successful page response
      mockPage.goto.mockResolvedValue({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK'
      });

      // Mock screenshot file creation
      mockPage.screenshot.mockImplementation(async (options) => {
        // Create a dummy file
        const buffer = Buffer.from('fake-image-data');
        await fs.writeFile(options.path, buffer);
      });

      await screenshotService.initializeBrowser();
    });

    test('should configure page correctly for screenshot', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1200,
        height: 800,
        isMobile: false,
        hasTouch: false
      });

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(
        expect.stringContaining('Mozilla/5.0')
      );

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        {
          waitUntil: 'networkidle2',
          timeout: 30000
        }
      );
    });

    test('should handle mobile viewport correctly', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90,
        device: 'mobile'
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 375, // Should be clamped to mobile width
        height: 667, // Should be clamped to mobile height
        isMobile: true,
        hasTouch: true
      });
    });

    test('should handle tablet viewport correctly', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 1200,
        format: 'png',
        quality: 90,
        device: 'tablet'
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 768, // Should be clamped to tablet width
        height: 1024, // Should be clamped to tablet height
        isMobile: true,
        hasTouch: true
      });
    });

    test('should handle full page screenshots', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90,
        fullPage: true
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'png',
          fullPage: true
        })
      );
    });

    test('should handle clipped screenshots', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90,
        fullPage: false
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'png',
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: 1200,
            height: 800
          }
        })
      );
    });

    test('should handle different image formats', async () => {
      const formats = [
        { format: 'png', expectedType: 'png' },
        { format: 'jpg', expectedType: 'jpeg' },
        { format: 'jpeg', expectedType: 'jpeg' }
      ];

      for (const { format, expectedType } of formats) {
        const options = {
          url: 'https://example.com',
          width: 800,
          height: 600,
          format,
          quality: 80
        };

        await screenshotService.captureScreenshot(options);

        expect(mockPage.screenshot).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expectedType
          })
        );
      }
    });

    test('should handle page loading failures', async () => {
      mockPage.goto.mockResolvedValue({
        ok: () => false,
        status: () => 404,
        statusText: () => 'Not Found'
      });

      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      const result = await screenshotService.captureScreenshot(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load page - HTTP 404');
    });

    test('should handle navigation timeouts', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation timeout of 30000 ms exceeded'));

      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      const result = await screenshotService.captureScreenshot(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page loading timeout exceeded');
    });

    test('should close page after screenshot', async () => {
      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.close).toHaveBeenCalled();
    });

    test('should close page even on error', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const options = {
        url: 'https://example.com',
        width: 1200,
        height: 800,
        format: 'png',
        quality: 90
      };

      await screenshotService.captureScreenshot(options);

      expect(mockPage.close).toHaveBeenCalled();
    });
  });

  describe('Job Processing (Mocked)', () => {
    beforeEach(async () => {
      // Mock successful screenshot capture
      mockPage.goto.mockResolvedValue({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK'
      });

      mockPage.screenshot.mockImplementation(async (options) => {
        const buffer = Buffer.from('fake-image-data');
        await fs.writeFile(options.path, buffer);
      });

      await screenshotService.initializeBrowser();
    });

    test('should process job successfully', async () => {
      // Create a test job
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
      expect(result.result).toHaveProperty('thumbnailPath');
      expect(result.result).toHaveProperty('fileName');
      expect(result.result).toHaveProperty('fileSize');

      // Check job was updated
      const updatedJob = await db.findCaptureJobById(job.id);
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.result).toBeDefined();
    });

    test('should handle job processing failures', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      // Create a test job
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

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Check job was marked as failed
      const updatedJob = await db.findCaptureJobById(job.id);
      expect(updatedJob.status).toBe('failed');
      expect(updatedJob.errorMessage).toBeDefined();
    });

    test('should handle non-existent jobs', async () => {
      const result = await screenshotService.processJob('non-existent-job-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });
  });

  describe('Utility Functions', () => {
    test('should generate unique filenames', () => {
      const filename1 = screenshotService.generateFileName('png');
      const filename2 = screenshotService.generateFileName('png');

      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^screenshot_\d+_[a-f0-9]{16}\.png$/);
      expect(filename2).toMatch(/^screenshot_\d+_[a-f0-9]{16}\.png$/);
    });

    test('should get correct viewport for devices', () => {
      const desktopViewport = screenshotService.getViewportForDevice('desktop', 1920, 1080);
      expect(desktopViewport).toEqual({
        width: 1920,
        height: 1080,
        isMobile: false,
        hasTouch: false
      });

      const mobileViewport = screenshotService.getViewportForDevice('mobile', 1920, 1080);
      expect(mobileViewport).toEqual({
        width: 375,
        height: 667,
        isMobile: true,
        hasTouch: true
      });

      const tabletViewport = screenshotService.getViewportForDevice('tablet', 1920, 1080);
      expect(tabletViewport).toEqual({
        width: 768,
        height: 1024,
        isMobile: true,
        hasTouch: true
      });
    });
  });
});