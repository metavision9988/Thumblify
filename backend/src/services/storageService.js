const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class StorageService {
  constructor() {
    // Configuration
    this.bucketName = process.env.AWS_S3_BUCKET || 'thumblify-screenshots';
    this.region = process.env.AWS_S3_REGION || 'us-east-1';
    
    // Initialize S3
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: this.region
    });
    
    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: this.region,
      signatureVersion: 'v4'
    });

    console.log(`StorageService initialized with bucket: ${this.bucketName}, region: ${this.region}`);
  }

  /**
   * Upload a file to S3
   * @param {string} filePath - Local file path
   * @param {string} key - S3 key (path)
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadFile(filePath, key, options = {}) {
    try {
      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const contentType = this.getContentType(key);
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: options.acl || 'public-read'
      };

      // Add metadata if provided
      if (options.metadata) {
        uploadParams.Metadata = options.metadata;
      }

      // Add cache control
      if (options.cacheControl) {
        uploadParams.CacheControl = options.cacheControl;
      } else {
        uploadParams.CacheControl = 'max-age=31536000'; // 1 year default
      }

      console.log(`Uploading file to S3: ${key}`);
      const result = await this.s3.upload(uploadParams).promise();
      
      console.log(`File uploaded successfully: ${result.Location}`);
      
      return {
        success: true,
        url: result.Location,
        key: result.Key,
        etag: result.ETag,
        bucket: result.Bucket
      };
      
    } catch (error) {
      console.error(`S3 upload failed for ${key}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 key to delete
   * @returns {Object} Delete result
   */
  async deleteFile(key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key
      };

      await this.s3.deleteObject(deleteParams).promise();
      
      console.log(`File deleted from S3: ${key}`);
      
      return {
        success: true,
        key: key
      };
      
    } catch (error) {
      console.error(`S3 delete failed for ${key}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a signed URL for private file access
   * @param {string} key - S3 key
   * @param {number} expires - Expiration time in seconds
   * @returns {string} Signed URL
   */
  async getSignedUrl(key, expires = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expires
      };

      const url = this.s3.getSignedUrl('getObject', params);
      return url;
      
    } catch (error) {
      console.error(`Failed to generate signed URL for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Copy a file within S3
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   * @returns {Object} Copy result
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      };

      const result = await this.s3.copyObject(copyParams).promise();
      
      console.log(`File copied in S3: ${sourceKey} -> ${destinationKey}`);
      
      return {
        success: true,
        sourceKey: sourceKey,
        destinationKey: destinationKey,
        etag: result.CopyObjectResult.ETag
      };
      
    } catch (error) {
      console.error(`S3 copy failed: ${sourceKey} -> ${destinationKey}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files in parallel
   * @param {Array} files - Array of {filePath, key} objects
   * @returns {Array} Upload results
   */
  async uploadMultipleFiles(files) {
    const uploadPromises = files.map(file => 
      this.uploadFile(file.filePath, file.key, file.options)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Delete multiple files in parallel
   * @param {Array} keys - Array of S3 keys to delete
   * @returns {Array} Delete results
   */
  async deleteMultipleFiles(keys) {
    const deletePromises = keys.map(key => this.deleteFile(key));
    return Promise.all(deletePromises);
  }

  /**
   * Upload file and cleanup local file
   * @param {string} filePath - Local file path
   * @param {string} key - S3 key
   * @param {Object} options - Upload options
   * @returns {Object} Upload result
   */
  async uploadAndCleanup(filePath, key, options = {}) {
    try {
      // Upload to S3
      const uploadResult = await this.uploadFile(filePath, key, options);
      
      if (uploadResult.success) {
        // Clean up local file
        try {
          await fs.unlink(filePath);
          console.log(`Local file cleaned up: ${filePath}`);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup local file ${filePath}:`, cleanupError.message);
          // Don't fail the overall operation for cleanup issues
        }
      }
      
      return uploadResult;
      
    } catch (error) {
      console.error('Upload and cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a unique key for screenshots
   * @param {string} userId - User ID
   * @param {string} format - File format (png, jpg, webp, etc.)
   * @returns {string} S3 key
   */
  generateScreenshotKey(userId, format) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    return `screenshots/${userId}/${timestamp}_${randomId}.${format}`;
  }

  /**
   * Generate a unique key for thumbnails with date organization
   * @param {string} userId - User ID
   * @param {string} format - File format
   * @returns {string} S3 key
   */
  generateThumbnailKey(userId, format) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    return `thumbnails/${userId}/${year}/${month}/${day}/${timestamp}_${randomId}.${format}`;
  }

  /**
   * Get content type from file extension
   * @param {string} key - File key/path
   * @returns {string} Content type
   */
  getContentType(key) {
    const ext = path.extname(key).toLowerCase();
    
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if S3 service is available
   * @returns {boolean} Service availability
   */
  async healthCheck() {
    try {
      // Try to list bucket to check connectivity
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      return true;
    } catch (error) {
      console.error('S3 health check failed:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics for a user
   * @param {string} userId - User ID
   * @returns {Object} Usage statistics
   */
  async getUserStorageStats(userId) {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: `screenshots/${userId}/`
      };

      const result = await this.s3.listObjectsV2(params).promise();
      
      let totalSize = 0;
      let fileCount = 0;
      
      result.Contents.forEach(object => {
        totalSize += object.Size;
        fileCount++;
      });
      
      return {
        userId: userId,
        fileCount: fileCount,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        lastModified: result.Contents.length > 0 ? 
          Math.max(...result.Contents.map(obj => new Date(obj.LastModified).getTime())) : null
      };
      
    } catch (error) {
      console.error(`Failed to get storage stats for user ${userId}:`, error);
      return {
        userId: userId,
        fileCount: 0,
        totalSizeBytes: 0,
        totalSizeMB: '0.00',
        error: error.message
      };
    }
  }

  /**
   * Clean up old files for a user (older than specified days)
   * @param {string} userId - User ID
   * @param {number} olderThanDays - Delete files older than this many days
   * @returns {Object} Cleanup result
   */
  async cleanupOldFiles(userId, olderThanDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const params = {
        Bucket: this.bucketName,
        Prefix: `screenshots/${userId}/`
      };

      const result = await this.s3.listObjectsV2(params).promise();
      
      const oldFiles = result.Contents.filter(object => 
        new Date(object.LastModified) < cutoffDate
      );
      
      if (oldFiles.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          message: 'No old files to clean up'
        };
      }
      
      const deleteKeys = oldFiles.map(file => file.Key);
      const deleteResults = await this.deleteMultipleFiles(deleteKeys);
      
      const successfulDeletes = deleteResults.filter(result => result.success).length;
      
      console.log(`Cleaned up ${successfulDeletes}/${oldFiles.length} old files for user ${userId}`);
      
      return {
        success: true,
        deletedCount: successfulDeletes,
        totalFound: oldFiles.length,
        cutoffDate: cutoffDate.toISOString()
      };
      
    } catch (error) {
      console.error(`Cleanup failed for user ${userId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = StorageService;