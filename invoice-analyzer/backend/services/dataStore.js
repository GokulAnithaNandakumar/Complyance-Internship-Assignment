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

  // Save report to database (required by PRD)
  async saveReport(report) {
    try {
      // Create a clean copy of the report for JSON serialization
      const cleanReport = JSON.parse(JSON.stringify(report));

      const query = `
        INSERT INTO reports (id, upload_id, created_at, scores_overall, report_json, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          report_json = EXCLUDED.report_json,
          scores_overall = EXCLUDED.scores_overall
        RETURNING id
      `;

      const values = [
        cleanReport.reportId,
        cleanReport.uploadId || null,
        new Date(),
        cleanReport.scores?.overall || 0,
        JSON.stringify(cleanReport),
        new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days from now
      ];

      const result = await pool.query(query, values);
      console.log('Report saved to database successfully:', result.rows[0].id);
      return result.rows[0];
    } catch (error) {
      console.error('Database save error:', error);
      // Fallback to memory storage
      this.memoryStore.set(report.reportId, {
        data: report,
        timestamp: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      });
      console.log('Report saved to memory storage as fallback:', report.reportId);
      return { id: report.reportId };
    }
  }

  // Get report from database (required by PRD)
  async getReport(reportId) {
    try {
      const query = 'SELECT report_json FROM reports WHERE id = $1 AND expires_at > NOW()';
      const result = await pool.query(query, [reportId]);

      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].report_json);
      }

      // Fallback to memory storage
      const memoryRecord = this.memoryStore.get(reportId);
      if (memoryRecord && Date.now() <= memoryRecord.expiresAt) {
        return memoryRecord.data;
      }

      return null;
    } catch (error) {
      console.error('Database retrieval error:', error);

      // Fallback to memory storage
      const memoryRecord = this.memoryStore.get(reportId);
      if (memoryRecord && Date.now() <= memoryRecord.expiresAt) {
        return memoryRecord.data;
      }

      return null;
    }
  }

  // Get recent reports (P1 feature)
  async getRecentReports(limit = 10) {
    try {
      const query = `
        SELECT id, created_at, scores_overall,
               report_json->>'meta' as meta_json
        FROM reports
        WHERE expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      return result.rows.map(row => {
        let country = null;
        let erp = null;

        try {
          const meta = JSON.parse(row.meta_json || '{}');
          country = meta.country;
          erp = meta.erp;
        } catch (e) {
          // Ignore parse errors
        }

        return {
          id: row.id,
          created_at: row.created_at,
          scores_overall: row.scores_overall,
          country,
          erp
        };
      });
    } catch (error) {
      console.error('Database query error:', error);

      // Fallback to memory storage
      const reports = [];
      for (const [id, record] of this.memoryStore.entries()) {
        if (Date.now() <= record.expiresAt && record.data.reportId) {
          reports.push({
            id: record.data.reportId,
            created_at: new Date(record.timestamp),
            scores_overall: record.data.scores?.overall || 0,
            country: record.data.meta?.country || null,
            erp: record.data.meta?.erp || null
          });
        }
      }

      return reports.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
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