// For now, we'll use a simple in-memory store for testing
// Later we'll implement Prisma with PostgreSQL

class InMemoryDB {
  constructor() {
    this.users = new Map();
    this.captureJobs = new Map();
    this.templates = new Map();
    this.usageRecords = [];
    this.nextId = 1;
  }

  generateId() {
    return `id_${this.nextId++}`;
  }

  // User operations
  async createUser(userData) {
    const id = userData.id || this.generateId();
    const user = {
      id,
      email: userData.email,
      passwordHash: userData.passwordHash,
      planType: userData.planType || 'free',
      apiKey: userData.apiKey,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.users.set(id, user);
    
    // Return user without password hash for create response
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async findUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id) {
    return this.users.get(id) || null;
  }

  async findUserByApiKey(apiKey) {
    for (const user of this.users.values()) {
      if (user.apiKey === apiKey) {
        return user;
      }
    }
    return null;
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }
    
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Capture job operations
  async createCaptureJob(jobData) {
    const id = jobData.id || this.generateId();
    const job = {
      id,
      userId: jobData.userId,
      type: jobData.type,
      source: jobData.source,
      status: jobData.status || 'pending',
      options: jobData.options || {},
      result: jobData.result || null,
      errorMessage: jobData.errorMessage || null,
      processingStartedAt: jobData.processingStartedAt || null,
      processingCompletedAt: jobData.processingCompletedAt || null,
      createdAt: jobData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.captureJobs.set(id, job);
    return job;
  }

  async findCaptureJobById(id) {
    return this.captureJobs.get(id) || null;
  }

  async findCaptureJobsByUserId(userId, options = {}) {
    const userJobs = Array.from(this.captureJobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (!options.page && !options.limit) {
      return userJobs;
    }
    
    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    
    const jobs = userJobs.slice(offset, offset + limit);
    const totalCount = userJobs.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      jobs,
      totalCount,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
  }

  async updateCaptureJob(id, updates) {
    const job = this.captureJobs.get(id);
    if (!job) {
      return null;
    }
    
    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.captureJobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteCaptureJob(id) {
    const job = this.captureJobs.get(id);
    if (!job) {
      return false;
    }
    
    this.captureJobs.delete(id);
    return true;
  }

  // Usage analytics operations
  async createUsageRecord(usageData) {
    const record = {
      id: this.generateId(),
      userId: usageData.userId,
      jobId: usageData.jobId,
      type: usageData.type,
      timestamp: usageData.timestamp || new Date().toISOString(),
      metadata: usageData.metadata || {}
    };
    
    this.usageRecords.push(record);
    return record;
  }

  async getUserUsageAnalytics(userId, options = {}) {
    const { startDate, endDate } = options;
    
    let userRecords = this.usageRecords.filter(record => record.userId === userId);
    
    if (startDate || endDate) {
      userRecords = userRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
        
        return recordDate >= start && recordDate <= end;
      });
    }
    
    const totalJobs = userRecords.length;
    const jobsByType = {};
    
    userRecords.forEach(record => {
      jobsByType[record.type] = (jobsByType[record.type] || 0) + 1;
    });
    
    return {
      totalJobs,
      jobsByType,
      records: userRecords
    };
  }

  // Clear all data (for testing)
  async clear() {
    this.users.clear();
    this.captureJobs.clear();
    this.templates.clear();
    this.usageRecords = [];
    this.nextId = 1;
  }
}

// Singleton instance
let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new InMemoryDB();
  }
  return dbInstance;
}

module.exports = { getDB, InMemoryDB };