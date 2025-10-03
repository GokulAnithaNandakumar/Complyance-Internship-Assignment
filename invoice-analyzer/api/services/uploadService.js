const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { parseCSV, parseJSON, processData } = require('../utils/dataProcessor');

class UploadService {
  constructor() {
    this.maxFileSize = process.env.MAX_FILE_SIZE || 5242880; // 5MB
    this.maxRows = process.env.MAX_ROWS_TO_PROCESS || 200;
  }

  // Process file upload
  async processUpload(fileData, metadata = {}) {
    const uploadId = `u_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    
    try {
      // Validate file size
      const fileSize = Buffer.isBuffer(fileData) ? fileData.length : fileData.length;
      if (fileSize > this.maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      // Determine file type and parse data
      const { data, fileType } = await this.parseFileData(fileData, metadata);
      
      // Process and limit data
      const processedData = processData(data, this.maxRows);

      // Save upload record
      await this.saveUpload(uploadId, processedData, metadata, fileType);

      return {
        uploadId,
        processedData,
        metadata: {
          fileType,
          totalRows: processedData.totalRows,
          processedRows: processedData.processedRows,
          truncated: processedData.truncated
        }
      };

    } catch (error) {
      console.error('Upload processing error:', error);
      throw error;
    }
  }

  // Parse file data based on type
  async parseFileData(fileData, metadata) {
    const content = Buffer.isBuffer(fileData) ? fileData.toString('utf8') : fileData;
    
    // Auto-detect file type if not provided
    let fileType = metadata.fileType;
    if (!fileType) {
      fileType = this.detectFileType(content, metadata.filename);
    }

    let data;
    
    try {
      switch (fileType.toLowerCase()) {
        case 'csv':
          data = await parseCSV(content);
          break;
        case 'json':
          data = parseJSON(content);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${fileType.toUpperCase()} data: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No valid data found in the uploaded file');
    }

    return { data, fileType };
  }

  // Auto-detect file type
  detectFileType(content, filename) {
    // Check filename extension first
    if (filename) {
      const extension = filename.toLowerCase().split('.').pop();
      if (extension === 'csv') return 'csv';
      if (extension === 'json') return 'json';
    }

    // Check content format
    const trimmedContent = content.trim();
    
    // JSON detection
    if ((trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) ||
        (trimmedContent.startsWith('{') && trimmedContent.endsWith('}'))) {
      try {
        JSON.parse(trimmedContent);
        return 'json';
      } catch (e) {
        // Not valid JSON, continue to CSV check
      }
    }

    // CSV detection (look for comma-separated values)
    const lines = trimmedContent.split('\n');
    if (lines.length > 1) {
      const firstLine = lines[0];
      const secondLine = lines[1];
      
      // Check if first line looks like headers and second line has similar structure
      if (firstLine.includes(',') && secondLine.includes(',')) {
        const firstLineFields = firstLine.split(',').length;
        const secondLineFields = secondLine.split(',').length;
        
        if (firstLineFields === secondLineFields && firstLineFields > 1) {
          return 'csv';
        }
      }
    }

    throw new Error('Unable to detect file type. Please specify CSV or JSON format.');
  }

  // Save upload record to database
  async saveUpload(uploadId, processedData, metadata, fileType) {
    try {
      await pool.query(
        `INSERT INTO uploads (id, country, erp, rows_parsed, file_type, original_filename) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uploadId,
          metadata.country || null,
          metadata.erp || null,
          processedData.processedRows,
          fileType,
          metadata.filename || null
        ]
      );
    } catch (error) {
      console.error('Error saving upload:', error);
      throw new Error('Failed to save upload record');
    }
  }

  // Get upload record
  async getUpload(uploadId) {
    try {
      const result = await pool.query(
        'SELECT * FROM uploads WHERE id = $1',
        [uploadId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error retrieving upload:', error);
      throw new Error('Failed to retrieve upload record');
    }
  }

  // Validate upload before analysis
  async validateUpload(uploadId) {
    const upload = await this.getUpload(uploadId);
    
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Check if upload is not too old (optional validation)
    const uploadAge = Date.now() - new Date(upload.created_at).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (uploadAge > maxAge) {
      throw new Error('Upload has expired');
    }

    return upload;
  }

  // Process text upload (for paste functionality)
  async processTextUpload(text, metadata = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('No text data provided');
    }

    return await this.processUpload(text, {
      ...metadata,
      fileType: metadata.fileType || this.detectFileType(text)
    });
  }

  // Get upload statistics
  async getUploadStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_uploads,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as uploads_last_24h,
          AVG(rows_parsed) as avg_rows_parsed,
          MAX(rows_parsed) as max_rows_parsed
        FROM uploads
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error retrieving upload stats:', error);
      return null;
    }
  }
}

module.exports = UploadService;