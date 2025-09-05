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
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920x1080'
        ],
        defaultViewport: null,
        timeout: 60000,
        devtools: false
      });

      console.log('Browser initialized for advanced rendering');
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

  async waitForCompleteRendering(page) {
    try {
      // Wait for all images to load
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000); // Max wait 5s per image
          });
        }));
      });

      // Wait for fonts to load
      await page.evaluateHandle(() => document.fonts.ready);

      // Wait for CSS animations and transitions
      await page.evaluate(() => {
        return new Promise(resolve => {
          const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              observer.disconnect();
              resolve();
            }, 1000);
          });
          
          let timeout = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 1000);
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
        });
      });

      // Wait for JavaScript frameworks (React, Vue, Angular)
      await page.evaluate(() => {
        return new Promise(resolve => {
          const checkFrameworks = () => {
            // React
            if (window.React && window.ReactDOM) {
              if (window.ReactDOM.version && window.ReactDOM.version.startsWith('18')) {
                // React 18 with concurrent features
                setTimeout(resolve, 1500);
                return;
              }
            }
            
            // Vue.js
            if (window.Vue) {
              setTimeout(resolve, 1000);
              return;
            }
            
            // Angular
            if (window.ng || window.angular) {
              setTimeout(resolve, 1500);
              return;
            }
            
            // General DOM stability check
            setTimeout(resolve, 800);
          };
          
          if (document.readyState === 'complete') {
            checkFrameworks();
          } else {
            window.addEventListener('load', checkFrameworks);
          }
        });
      });

      // Additional wait for Tailwind CSS and dynamic content
      await page.waitForTimeout(2000);

      console.log('Complete rendering wait finished');
    } catch (error) {
      console.warn('Error during rendering wait:', error.message);
      // Fallback wait
      await page.waitForTimeout(3000);
    }
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
      
      // Set viewport based on device and preset
      const viewport = this.getViewportForDevice(device, width, height, options.preset);
      await page.setViewport(viewport);
      
      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      // Set timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      
      console.log(`Navigating to: ${url}`);
      
      // Navigate to URL with extended waiting
      const response = await page.goto(url, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: timeout
      });
      
      if (!response) {
        throw new Error('Failed to load page - no response');
      }
      
      if (!response.ok()) {
        throw new Error(`Failed to load page - HTTP ${response.status()}: ${response.statusText()}`);
      }
      
      console.log('Page loaded, waiting for complete rendering...');
      
      // Wait for JavaScript execution and CSS rendering
      await this.waitForCompleteRendering(page);
      
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

  getResolutionPresets() {
    return {
      // Mobile Resolutions
      'mobile-portrait': { width: 375, height: 667, label: 'Mobile Portrait (375×667)' },
      'mobile-landscape': { width: 667, height: 375, label: 'Mobile Landscape (667×375)' },
      'iphone-14': { width: 390, height: 844, label: 'iPhone 14 (390×844)' },
      'iphone-14-pro': { width: 393, height: 852, label: 'iPhone 14 Pro (393×852)' },
      'android-standard': { width: 360, height: 640, label: 'Android Standard (360×640)' },
      
      // Tablet Resolutions
      'ipad': { width: 768, height: 1024, label: 'iPad (768×1024)' },
      'ipad-pro': { width: 1024, height: 1366, label: 'iPad Pro (1024×1366)' },
      'tablet-landscape': { width: 1024, height: 768, label: 'Tablet Landscape (1024×768)' },
      
      // Desktop Resolutions
      'desktop-hd': { width: 1366, height: 768, label: 'Desktop HD (1366×768)' },
      'desktop-fhd': { width: 1920, height: 1080, label: 'Desktop FHD (1920×1080)' },
      'desktop-2k': { width: 2560, height: 1440, label: 'Desktop 2K (2560×1440)' },
      'desktop-4k': { width: 3840, height: 2160, label: 'Desktop 4K (3840×2160)' },
      
      // Social Media Presets
      'facebook-post': { width: 1200, height: 630, label: 'Facebook Post (1200×630)' },
      'twitter-header': { width: 1500, height: 500, label: 'Twitter Header (1500×500)' },
      'instagram-square': { width: 1080, height: 1080, label: 'Instagram Square (1080×1080)' },
      'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story (1080×1920)' },
      'youtube-thumbnail': { width: 1280, height: 720, label: 'YouTube Thumbnail (1280×720)' },
      
      // Web Standard Presets
      'web-banner': { width: 1200, height: 400, label: 'Web Banner (1200×400)' },
      'blog-header': { width: 1200, height: 600, label: 'Blog Header (1200×600)' },
      'thumbnail-large': { width: 800, height: 600, label: 'Large Thumbnail (800×600)' },
      'thumbnail-medium': { width: 400, height: 300, label: 'Medium Thumbnail (400×300)' },
      'thumbnail-small': { width: 200, height: 150, label: 'Small Thumbnail (200×150)' },
      
      // Custom Standard Sizes
      'square-large': { width: 1000, height: 1000, label: 'Square Large (1000×1000)' },
      'square-medium': { width: 500, height: 500, label: 'Square Medium (500×500)' },
      'portrait': { width: 800, height: 1200, label: 'Portrait (800×1200)' },
      'landscape': { width: 1200, height: 800, label: 'Landscape (1200×800)' }
    };
  }

  getViewportForDevice(device, width, height, preset = null) {
    // If preset is provided, use it
    if (preset) {
      const presets = this.getResolutionPresets();
      if (presets[preset]) {
        const presetData = presets[preset];
        return {
          width: presetData.width,
          height: presetData.height,
          isMobile: presetData.width <= 768,
          hasTouch: presetData.width <= 768,
          deviceScaleFactor: presetData.width <= 768 ? 2 : 1
        };
      }
    }

    switch (device) {
      case 'mobile':
        return {
          width: width || 375,
          height: height || 667,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2
        };
      case 'tablet':
        return {
          width: width || 768,
          height: height || 1024,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2
        };
      default: // desktop
        return {
          width: width || 1920,
          height: height || 1080,
          isMobile: false,
          hasTouch: false,
          deviceScaleFactor: 1
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