const StorageService = require('../src/services/storageService');
const fs = require('fs').promises;
const path = require('path');

// Mock AWS SDK
jest.mock('aws-sdk');
const AWS = require('aws-sdk');

describe('Storage Service', () => {
  let storageService;
  let mockS3;
  let testFilePath;

  beforeAll(async () => {
    // Create a test file
    testFilePath = path.join(__dirname, 'test-image.png');
    await fs.writeFile(testFilePath, Buffer.from('fake-image-data'));
  });

  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(() => {
    // Setup S3 mock
    mockS3 = {
      upload: jest.fn(),
      deleteObject: jest.fn(),
      getSignedUrl: jest.fn(),
      copyObject: jest.fn()
    };

    AWS.S3.mockImplementation(() => mockS3);
    
    storageService = new StorageService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(storageService.bucketName).toBeDefined();
      expect(storageService.region).toBeDefined();
      expect(storageService.s3).toBeDefined();
    });

    test('should use environment variables for configuration', () => {
      process.env.AWS_S3_BUCKET = 'test-bucket';
      process.env.AWS_S3_REGION = 'us-west-2';
      
      const service = new StorageService();
      expect(service.bucketName).toBe('test-bucket');
      expect(service.region).toBe('us-west-2');
    });
  });

  describe('File Upload', () => {
    test('should upload file successfully', async () => {
      const mockUploadResult = {
        Location: 'https://test-bucket.s3.amazonaws.com/screenshots/test-image.png',
        ETag: '"abc123"',
        Bucket: 'test-bucket',
        Key: 'screenshots/test-image.png'
      };

      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue(mockUploadResult)
      });

      const result = await storageService.uploadFile(testFilePath, 'screenshots/test-image.png');

      expect(result.success).toBe(true);
      expect(result.url).toBe(mockUploadResult.Location);
      expect(result.key).toBe('screenshots/test-image.png');
      expect(result.etag).toBe('"abc123"');

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: storageService.bucketName,
          Key: 'screenshots/test-image.png',
          Body: expect.any(Buffer),
          ContentType: 'image/png',
          ACL: 'public-read'
        })
      );
    });

    test('should handle upload failures', async () => {
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Upload failed'))
      });

      const result = await storageService.uploadFile(testFilePath, 'screenshots/test-image.png');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    test('should detect content type correctly', async () => {
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test.com/test.jpg',
          ETag: '"123"',
          Key: 'test.jpg'
        })
      });

      await storageService.uploadFile(testFilePath, 'screenshots/test.jpg');

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/jpeg'
        })
      );
    });

    test('should handle different image formats', async () => {
      const formats = [
        { ext: '.png', contentType: 'image/png' },
        { ext: '.jpg', contentType: 'image/jpeg' },
        { ext: '.jpeg', contentType: 'image/jpeg' },
        { ext: '.webp', contentType: 'image/webp' },
        { ext: '.gif', contentType: 'image/gif' }
      ];

      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test.com/test.png',
          ETag: '"123"',
          Key: 'test.png'
        })
      });

      for (const format of formats) {
        const key = `screenshots/test${format.ext}`;
        await storageService.uploadFile(testFilePath, key);

        expect(mockS3.upload).toHaveBeenCalledWith(
          expect.objectContaining({
            ContentType: format.contentType
          })
        );

        jest.clearAllMocks();
      }
    });

    test('should add metadata to uploaded files', async () => {
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test.com/test.png',
          ETag: '"123"',
          Key: 'test.png'
        })
      });

      const metadata = {
        userId: 'user123',
        jobId: 'job456',
        originalUrl: 'https://example.com',
        captureDate: '2024-01-01T00:00:00Z'
      };

      await storageService.uploadFile(testFilePath, 'screenshots/test.png', { metadata });

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: metadata
        })
      );
    });
  });

  describe('File Management', () => {
    test('should delete file successfully', async () => {
      mockS3.deleteObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const result = await storageService.deleteFile('screenshots/test-image.png');

      expect(result.success).toBe(true);
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: storageService.bucketName,
        Key: 'screenshots/test-image.png'
      });
    });

    test('should handle delete failures', async () => {
      mockS3.deleteObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Delete failed'))
      });

      const result = await storageService.deleteFile('screenshots/test-image.png');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delete failed');
    });

    test('should generate signed URLs', async () => {
      const signedUrl = 'https://test-bucket.s3.amazonaws.com/screenshots/test.png?signed-params';
      mockS3.getSignedUrl.mockReturnValue(signedUrl);

      const url = await storageService.getSignedUrl('screenshots/test.png', 3600);

      expect(url).toBe(signedUrl);
      expect(mockS3.getSignedUrl).toHaveBeenCalledWith('getObject', {
        Bucket: storageService.bucketName,
        Key: 'screenshots/test.png',
        Expires: 3600
      });
    });

    test('should copy files between locations', async () => {
      mockS3.copyObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          CopyObjectResult: {
            ETag: '"def456"',
            LastModified: new Date()
          }
        })
      });

      const result = await storageService.copyFile(
        'screenshots/temp.png',
        'screenshots/final.png'
      );

      expect(result.success).toBe(true);
      expect(mockS3.copyObject).toHaveBeenCalledWith({
        Bucket: storageService.bucketName,
        CopySource: `${storageService.bucketName}/screenshots/temp.png`,
        Key: 'screenshots/final.png'
      });
    });
  });

  describe('Key Generation', () => {
    test('should generate unique keys for screenshots', () => {
      const key1 = storageService.generateScreenshotKey('user123', 'png');
      const key2 = storageService.generateScreenshotKey('user123', 'png');

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^screenshots\/user123\/\d+_[a-f0-9]{16}\.png$/);
      expect(key2).toMatch(/^screenshots\/user123\/\d+_[a-f0-9]{16}\.png$/);
    });

    test('should generate keys with different formats', () => {
      const pngKey = storageService.generateScreenshotKey('user123', 'png');
      const jpgKey = storageService.generateScreenshotKey('user123', 'jpg');
      const webpKey = storageService.generateScreenshotKey('user123', 'webp');

      expect(pngKey).toContain('.png');
      expect(jpgKey).toContain('.jpg');
      expect(webpKey).toContain('.webp');
    });

    test('should organize keys by user', () => {
      const key1 = storageService.generateScreenshotKey('user1', 'png');
      const key2 = storageService.generateScreenshotKey('user2', 'png');

      expect(key1).toContain('screenshots/user1/');
      expect(key2).toContain('screenshots/user2/');
    });
  });

  describe('Batch Operations', () => {
    test('should upload multiple files', async () => {
      const files = [
        { filePath: testFilePath, key: 'screenshots/test1.png' },
        { filePath: testFilePath, key: 'screenshots/test2.png' }
      ];

      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test.com/test.png',
          ETag: '"123"',
          Key: 'test.png'
        })
      });

      const results = await storageService.uploadMultipleFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockS3.upload).toHaveBeenCalledTimes(2);
    });

    test('should handle mixed success/failure in batch uploads', async () => {
      const files = [
        { filePath: testFilePath, key: 'screenshots/test1.png' },
        { filePath: testFilePath, key: 'screenshots/test2.png' }
      ];

      mockS3.upload
        .mockReturnValueOnce({
          promise: jest.fn().mockResolvedValue({
            Location: 'https://test.com/test1.png',
            ETag: '"123"',
            Key: 'test1.png'
          })
        })
        .mockReturnValueOnce({
          promise: jest.fn().mockRejectedValue(new Error('Upload failed'))
        });

      const results = await storageService.uploadMultipleFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    test('should delete multiple files', async () => {
      const keys = ['screenshots/test1.png', 'screenshots/test2.png'];

      mockS3.deleteObject.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const results = await storageService.deleteMultipleFiles(keys);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockS3.deleteObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Methods', () => {
    test('should upload and move local file to cloud', async () => {
      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://test-bucket.s3.amazonaws.com/screenshots/test.png',
          ETag: '"abc123"',
          Bucket: 'test-bucket',
          Key: 'screenshots/test.png'
        })
      });

      const result = await storageService.uploadAndCleanup(
        testFilePath,
        'screenshots/test.png'
      );

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test-bucket.s3.amazonaws.com/screenshots/test.png');
      
      // Note: In real implementation, this would also delete the local file
    });
  });
});