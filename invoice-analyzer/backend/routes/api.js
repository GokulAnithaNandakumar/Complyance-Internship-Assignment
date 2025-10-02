const express = require('express');
const multer = require('multer');
const UploadService = require('../services/uploadService');
const FieldMapper = require('../services/fieldMapper');
const RulesValidator = require('../services/rulesValidator');
const ScoringService = require('../services/scoringService');
const ReportService = require('../services/reportService');
const dataStore = require('../services/dataStore');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json', 'text/plain'];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.csv') || 
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and JSON files are allowed.'));
    }
  }
});

// Initialize services
const uploadService = new UploadService();
const fieldMapper = new FieldMapper();
const rulesValidator = new RulesValidator();
const scoringService = new ScoringService();
const reportService = new ReportService();

// POST /upload - Upload and process invoice data
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    let uploadResult;

    if (req.file) {
      // File upload
      uploadResult = await uploadService.processUpload(req.file.buffer, {
        filename: req.file.originalname,
        fileType: req.file.originalname.endsWith('.csv') ? 'csv' : 'json',
        country: req.body.country,
        erp: req.body.erp
      });
    } else if (req.body.text) {
      // Text upload
      uploadResult = await uploadService.processTextUpload(req.body.text, {
        country: req.body.country,
        erp: req.body.erp
      });
    } else {
      return res.status(400).json({
        error: 'No file or text data provided',
        message: 'Please provide either a file or text data to upload'
      });
    }

    // Store the processed data temporarily for analysis
    await dataStore.storeData(uploadResult.uploadId, uploadResult.processedData, uploadResult.metadata);

    res.json({
      uploadId: uploadResult.uploadId,
      metadata: uploadResult.metadata
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({
      error: error.message,
      details: 'Failed to process uploaded data'
    });
  }
});

// POST /analyze - Analyze uploaded data
router.post('/analyze', async (req, res) => {
  try {
    const { uploadId, questionnaire } = req.body;

    if (!uploadId) {
      return res.status(400).json({
        error: 'Missing uploadId',
        message: 'Upload ID is required for analysis'
      });
    }

    // Validate questionnaire
    if (!questionnaire || typeof questionnaire !== 'object') {
      return res.status(400).json({
        error: 'Invalid questionnaire',
        message: 'Questionnaire object is required'
      });
    }

    // Validate upload exists
    const upload = await uploadService.validateUpload(uploadId);
    
    // Get the processed data from data store
    const storedData = await dataStore.getData(uploadId);
    
    if (!storedData) {
      return res.status(404).json({
        error: 'Upload data not found',
        message: 'The uploaded data has expired or was not found. Please upload again.'
      });
    }

    const processedData = storedData.data;

    // Perform field mapping
    const fieldMapping = fieldMapper.mapFields(processedData.data);

    // Validate rules
    const rulesValidation = rulesValidator.validateRules(processedData.data, fieldMapping);

    // Calculate scores
    const scores = scoringService.calculateScores(
      processedData,
      fieldMapping,
      rulesValidation,
      questionnaire
    );

    // Generate report
    const report = await reportService.generateReport(
      uploadId,
      processedData,
      fieldMapping,
      rulesValidation,
      scores,
      questionnaire
    );

    res.json(report);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to analyze uploaded data'
    });
  }
});

// GET /report/:reportId - Retrieve saved report
router.get('/report/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({
        error: 'Missing report ID',
        message: 'Report ID is required'
      });
    }

    const report = await reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'The requested report was not found or has expired'
      });
    }

    res.json(report);

  } catch (error) {
    console.error('Report retrieval error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to retrieve report'
    });
  }
});

// GET /reports - Get recent reports (P1 feature)
router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 reports
    const reports = await reportService.getRecentReports(limit);

    res.json({
      reports,
      count: reports.length,
      limit
    });

  } catch (error) {
    console.error('Recent reports error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to retrieve recent reports'
    });
  }
});

// GET /health - Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const { testConnection } = require('../config/database');
    const dbConnected = await testConnection();
    
    const uploadStats = await uploadService.getUploadStats();
    const storeStats = dataStore.getStats();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        upload: 'operational',
        analysis: 'operational'
      },
      stats: {
        ...uploadStats,
        dataStore: storeStats
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: `File size exceeds the maximum limit of ${process.env.MAX_FILE_SIZE || 5242880} bytes`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: error.message
    });
  }
  next(error);
});

module.exports = router;