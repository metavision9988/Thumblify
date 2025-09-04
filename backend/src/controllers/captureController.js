const URLValidator = require('../utils/urlValidator');
const { captureUrlSchema } = require('../utils/validation');
const { successResponse, errorResponse } = require('../utils/response');
const { getDB } = require('../config/database');

class CaptureController {
  constructor() {
    this.urlValidator = new URLValidator();
    this.db = getDB();
  }

  async captureUrl(req, res) {
    try {
      // Validate request data
      const { error, value } = captureUrlSchema.validate(req.body);
      if (error) {
        return res.status(400).json(errorResponse(
          { message: error.details[0].message, code: 'VALIDATION_ERROR' }
        ));
      }

      // Validate URL safety
      try {
        this.urlValidator.validateUrl(value.url);
      } catch (urlError) {
        return res.status(400).json(errorResponse(
          { message: 'Invalid or unsafe URL: ' + urlError.message, code: 'UNSAFE_URL' }
        ));
      }

      // Create capture job in database
      const jobData = {
        userId: req.user.id,
        type: 'url',
        source: value.url,
        status: 'pending',
        options: value.options
      };

      const job = await this.db.createCaptureJob(jobData);

      // Create usage record
      await this.db.createUsageRecord({
        userId: req.user.id,
        jobId: job.id,
        type: 'url_capture',
        metadata: {
          url: value.url,
          format: value.options.format,
          dimensions: `${value.options.width}x${value.options.height}`
        }
      });

      const result = {
        jobId: job.id,
        status: job.status,
        url: job.source,
        options: job.options,
        createdAt: job.createdAt
      };

      res.status(201).json(successResponse(result, 'Capture job created'));
    } catch (err) {
      console.error('Capture error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async getJobs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status; // Optional status filter

      let jobs;
      if (limit > 0) {
        // Paginated results
        const result = await this.db.findCaptureJobsByUserId(req.user.id, { page, limit });
        
        // Filter by status if provided
        if (status && result.jobs) {
          result.jobs = result.jobs.filter(job => job.status === status);
          result.totalCount = result.jobs.length;
          result.totalPages = Math.ceil(result.totalCount / limit);
          result.hasNextPage = page < result.totalPages;
        }
        
        jobs = result;
      } else {
        // All results
        const allJobs = await this.db.findCaptureJobsByUserId(req.user.id);
        jobs = {
          jobs: status ? allJobs.filter(job => job.status === status) : allJobs,
          totalCount: allJobs.length,
          currentPage: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        };
      }

      res.status(200).json(successResponse(jobs, 'Jobs retrieved successfully'));
    } catch (err) {
      console.error('Get jobs error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async getJobById(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await this.db.findCaptureJobById(jobId);
      
      if (!job) {
        return res.status(404).json(errorResponse(
          { message: 'Capture job not found', code: 'JOB_NOT_FOUND' }
        ));
      }

      // Check if user owns this job
      if (job.userId !== req.user.id) {
        return res.status(403).json(errorResponse(
          { message: 'Access denied to this job', code: 'ACCESS_DENIED' }
        ));
      }

      res.status(200).json(successResponse(job, 'Job retrieved successfully'));
    } catch (err) {
      console.error('Get job error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async deleteJob(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await this.db.findCaptureJobById(jobId);
      
      if (!job) {
        return res.status(404).json(errorResponse(
          { message: 'Capture job not found', code: 'JOB_NOT_FOUND' }
        ));
      }

      // Check if user owns this job
      if (job.userId !== req.user.id) {
        return res.status(403).json(errorResponse(
          { message: 'Access denied to this job', code: 'ACCESS_DENIED' }
        ));
      }

      // Delete the job (for now just remove from memory)
      // In production, we might want to soft-delete or clean up associated files
      await this.db.deleteCaptureJob(jobId);

      res.status(200).json(successResponse(
        { jobId }, 
        'Capture job deleted successfully'
      ));
    } catch (err) {
      console.error('Delete job error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }

  async getUsageAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const analytics = await this.db.getUserUsageAnalytics(req.user.id, {
        startDate,
        endDate
      });

      res.status(200).json(successResponse(analytics, 'Usage analytics retrieved'));
    } catch (err) {
      console.error('Get analytics error:', err);
      res.status(500).json(errorResponse(
        { message: 'Internal server error', code: 'INTERNAL_ERROR' }
      ));
    }
  }
}

module.exports = CaptureController;