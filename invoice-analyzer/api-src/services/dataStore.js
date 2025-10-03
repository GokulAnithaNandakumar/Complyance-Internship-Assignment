const { pool } = require('../config/database');

class DataStore {
  constructor() {
    this.memoryStore = new Map(); // Temporary in-memory storage
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Store processed data temporarily
  async storeData(uploadId, data, metadata) {
    const record = {
      data,
      metadata,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.maxAge
    };
    
    this.memoryStore.set(uploadId, record);
    
    // Clean up expired entries
    this.cleanup();
    
    return true;
  }

  // Retrieve stored data
  async getData(uploadId) {
    const record = this.memoryStore.get(uploadId);
    
    if (!record) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > record.expiresAt) {
      this.memoryStore.delete(uploadId);
      return null;
    }
    
    return {
      data: record.data,
      metadata: record.metadata
    };
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.memoryStore.entries()) {
      if (now > record.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }

  // Get store statistics
  getStats() {
    this.cleanup();
    return {
      totalEntries: this.memoryStore.size,
      memoryUsage: process.memoryUsage()
    };
  }
}

// Singleton instance
const dataStore = new DataStore();

module.exports = dataStore;