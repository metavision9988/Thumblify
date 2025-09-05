const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getDB } = require('../config/database');
const StorageService = require('./storageService');

class ScreenshotService {
  constructor() {
    this.browser = null;
    this.db = getDB();
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.tempDir = path.join(__dirname, '../../temp');
    this.storageService = new StorageService();
    this.useCloudStorage = process.env.USE_CLOUD_STORAGE === 'true';
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  async initializeBrowser() {
    if (this.browser && this.browser.isConnected && this.browser.isConnected()) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ],
        defaultViewport: null,
        timeout: 30000
      });

      console.log('Browser initialized successfully');
      return this.browser;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  async closeBrowser() {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed successfully');
    }
  }

  generateFileName(format = 'png') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    return `screenshot_${timestamp}_${randomId}.${format}`;
  }

  async captureScreenshot(options) {
    const {
      url,
      width = 1200,
      height = 800,
      format = 'png',
      quality = 90,
      fullPage = false,
      device = 'desktop',
      timeout = 30000,
      optimize = false
    } = options;

    let page = null;
    let tempFilePath = null;
    
    try {
      // Initialize browser if needed
      await this.initializeBrowser();
      
      // Create new page
      page = await this.browser.newPage();
      
      // Set viewport based on device
      const viewport = this.getViewportForDevice(device, width, height);
      await page.setViewport(viewport);
      
      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      // Set timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      
      console.log(`Navigating to: ${url}`);
      
      // Navigate to URL
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: timeout
      });
      
      if (!response) {
        throw new Error('Failed to load page - no response');
      }
      
      if (!response.ok()) {
        throw new Error(`Failed to load page - HTTP ${response.status()}: ${response.statusText()}`);
      }
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);
      
      // Generate temporary filename
      const fileName = this.generateFileName(format);
      tempFilePath = path.join(this.tempDir, `temp_${fileName}`);
      
      // Screenshot options
      const screenshotOptions = {
        path: tempFilePath,
        type: format === 'jpg' ? 'jpeg' : format,
        fullPage: fullPage
      };
      
      if (format === 'jpeg' || format === 'jpg') {
        screenshotOptions.quality = quality;
      }
      
      if (!fullPage) {
        screenshotOptions.clip = {
          x: 0,
          y: 0,
          width: width,
          height: height
        };
      }
      
      console.log('Taking screenshot...');
      await page.screenshot(screenshotOptions);
      
      // Get original file stats
      const stats = await fs.stat(tempFilePath);
      const originalSize = stats.size;
      
      let finalFilePath = path.join(this.uploadsDir, fileName);
      let optimizedSize = originalSize;
      let dimensions = { width, height };
      
      // Optimize image if requested
      if (optimize) {
        const optimizeResult = await this.optimizeImage(tempFilePath, finalFilePath, {
          format,
          quality
        });
        optimizedSize = optimizeResult.size;
        dimensions = optimizeResult.dimensions;
      } else {
        // Just move the file
        await fs.rename(tempFilePath, finalFilePath);
        
        // Get actual dimensions
        const metadata = await sharp(finalFilePath).metadata();
        dimensions = {
          width: metadata.width,
          height: metadata.height
        };
      }
      
      console.log(`Screenshot captured successfully: ${fileName}`);
      
      return {
        success: true,
        filePath: finalFilePath,
        fileName: fileName,
        fileSize: optimizedSize,
        dimensions: dimensions,
        optimized: optimize,
        originalSize: originalSize,
        compressedSize: optimizedSize
      };
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      
      // Clean up temp file if it exists
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
      
      let errorMessage = error.message;
      
      if (error.message.includes('timeout')) {
        errorMessage = 'Page loading timeout exceeded';
      } else if (error.message.includes('net::')) {
        errorMessage = 'Failed to load page - network error';
      } else if (error.message.includes('Navigation failed')) {
        errorMessage = 'Failed to load page - navigation failed';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async optimizeImage(inputPath, outputPath, options) {
    const { format, quality } = options;
    
    let sharpInstance = sharp(inputPath);
    
    // Apply format-specific optimizations
    switch (format) {
      case 'jpg':
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ 
          quality,
          compressionLevel: 9,
          progressive: true
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ 
          quality,
          effort: 6
        });
        break;
    }
    
    // Process and save
    await sharpInstance.toFile(outputPath);
    
    // Get metadata and stats
    const metadata = await sharp(outputPath).metadata();
    const stats = await fs.stat(outputPath);
    
    return {
      size: stats.size,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      }
    };
  }

  getViewportForDevice(device, width, height) {
    switch (device) {
      case 'mobile':
        return {
          width: Math.min(width, 375),
          height: Math.min(height, 667),
          isMobile: true,
          hasTouch: true
        };
      case 'tablet':
        return {
          width: Math.min(width, 768),
          height: Math.min(height, 1024),
          isMobile: true,
          hasTouch: true
        };
      default: // desktop
        return {
          width: width,
          height: height,
          isMobile: false,
          hasTouch: false
        };
    }
  }

  async processJob(jobId) {
    try {
      const job = await this.db.findCaptureJobById(jobId);
      
      if (!job) {
        throw new Error('Job not found');
      }
      
      // Update job status to processing
      await this.db.updateCaptureJob(jobId, {
        status: 'processing',
        processingStartedAt: new Date().toISOString()
      });
      
      console.log(`Processing job ${jobId}: ${job.source}`);
      
      // Capture screenshot
      const screenshotResult = await this.captureScreenshot({
        url: job.source,
        ...job.options,
        optimize: true // Always optimize for production
      });
      
      if (!screenshotResult.success) {
        // Mark job as failed
        await this.db.updateCaptureJob(jobId, {
          status: 'failed',
          errorMessage: screenshotResult.error,
          processingCompletedAt: new Date().toISOString()
        });
        
        return {
          success: false,
          error: screenshotResult.error
        };
      }
      
      let finalResult = {
        thumbnailPath: screenshotResult.filePath,
        thumbnailUrl: `/uploads/${screenshotResult.fileName}`,
        fileName: screenshotResult.fileName,
        fileSize: screenshotResult.fileSize,
        dimensions: screenshotResult.dimensions,
        format: job.options.format,
        optimized: screenshotResult.optimized,
        originalSize: screenshotResult.originalSize,
        compressedSize: screenshotResult.compressedSize
      };

      // Upload to cloud storage if enabled
      if (this.useCloudStorage) {
        try {
          const storageKey = this.storageService.generateThumbnailKey(job.userId, job.options.format);
          const metadata = {
            userId: job.userId,
            jobId: job.id,
            originalUrl: job.source,
            captureDate: new Date().toISOString(),
            dimensions: `${screenshotResult.dimensions.width}x${screenshotResult.dimensions.height}`,
            format: job.options.format
          };

          const uploadResult = await this.storageService.uploadAndCleanup(
            screenshotResult.filePath,
            storageKey,
            { metadata, cacheControl: 'max-age=31536000, public' }
          );

          if (uploadResult.success) {
            finalResult = {
              ...finalResult,
              thumbnailUrl: uploadResult.url,
              cloudKey: uploadResult.key,
              cloudEtag: uploadResult.etag,
              storedInCloud: true
            };
            console.log(`File uploaded to cloud storage: ${uploadResult.url}`);
          } else {
            console.warn(`Cloud upload failed, using local storage: ${uploadResult.error}`);
          }
        } catch (cloudError) {
          console.warn('Cloud storage upload failed, using local storage:', cloudError);
        }
      }
      
      await this.db.updateCaptureJob(jobId, {
        status: 'completed',
        result: finalResult,
        processingCompletedAt: new Date().toISOString()
      });
      
      console.log(`Job ${jobId} completed successfully`);
      
      return {
        success: true,
        result: finalResult
      };
      
    } catch (error) {
      console.error(`Job processing failed for ${jobId}:`, error);
      
      // Try to update job status to failed
      try {
        await this.db.updateCaptureJob(jobId, {
          status: 'failed',
          errorMessage: error.message,
          processingCompletedAt: new Date().toISOString()
        });
      } catch (updateError) {
        console.error('Failed to update job status:', updateError);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanup() {
    try {
      // Close browser
      await this.closeBrowser();
      
      // Clean up temporary files older than 1 hour
      const tempFiles = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of tempFiles) {
        if (file.startsWith('temp_')) {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();
          
          if (age > 3600000) { // 1 hour
            await fs.unlink(filePath);
            console.log(`Cleaned up old temp file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = ScreenshotService;