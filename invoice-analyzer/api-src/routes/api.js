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

// AI Insights function using Gemini API
async function generateAiInsights(reportData, ruleFindings, coverage) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      overallAssessment: "AI insights are not available. Please configure GEMINI_API_KEY environment variable.",
      priorityIssues: [],
      fieldMappingSuggestions: [],
      nextSteps: []
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an expert e-invoicing compliance analyst. Analyze this invoice readiness report and provide actionable insights.

REPORT DATA:
- Overall Score: ${reportData.scores?.overall || 0}%
- Data Quality: ${reportData.scores?.breakdown?.data || 0}%
- Coverage: ${reportData.scores?.breakdown?.coverage || 0}%
- Rules Compliance: ${reportData.scores?.breakdown?.rules || 0}%
- Technical Posture: ${reportData.scores?.breakdown?.posture || 0}%

FAILED RULES:
${ruleFindings?.filter(r => !r.ok).map(r => `- ${r.rule}: ${r.value ? `Invalid value "${r.value}"` : ''} ${r.exampleLine ? `(Line ${r.exampleLine})` : ''}`).join('\n') || 'None'}

FIELD COVERAGE ANALYSIS:
- Total GETS fields required: ${(coverage?.matches?.length || 0) + (coverage?.close?.length || 0) + (coverage?.missing?.length || 0)}
- Successfully mapped: ${coverage?.matches?.length || 0}
- Close matches needing review: ${coverage?.close?.length || 0}
- Missing critical fields: ${coverage?.missing?.length || 0}

MISSING FIELDS: ${coverage?.missing?.map(m => m.gets_field || m).join(', ') || 'None'}
CLOSE MATCHES: ${coverage?.close?.map(c => `${c.source_field}→${c.gets_field}(${c.confidence}%)`).join(', ') || 'None'}

Focus your analysis on:
1. Critical missing fields that impact compliance
2. Data quality issues affecting e-invoicing
3. Field mapping improvements to boost coverage
4. Specific steps to improve the overall readiness score

Provide a JSON response with:
1. overallAssessment: Brief 2-3 sentence summary of readiness
2. priorityIssues: Array of {issue, recommendation} for critical problems (max 5)
3. fieldMappingSuggestions: Array of {mapping, rationale, priority} for close matches and missing fields (max 5)
4. nextSteps: Array of actionable next steps prioritized by impact (max 5)

Keep responses concise and business-focused.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
    }

    // Fallback response if JSON parsing fails
    return {
      overallAssessment: "Your invoice data shows areas for improvement in GETS compliance. Focus on addressing rule violations and field mapping first.",
      priorityIssues: ruleFindings?.filter(r => !r.ok).slice(0, 3).map(r => ({
        issue: `${r.rule.replace(/_/g, ' ')} validation failed`,
        recommendation: getBasicRecommendation(r.rule, r)
      })) || [],
      fieldMappingSuggestions: coverage?.close?.slice(0, 3).map(c => ({
        mapping: `${c.source_field} → ${c.gets_field}`,
        rationale: `${c.confidence}% confidence based on field similarity`
      })) || [],
      nextSteps: [
        "Fix critical rule violations first",
        "Review and confirm field mappings",
        "Validate data quality and completeness",
        "Test with additional invoice samples",
        "Consider implementing automated validation"
      ]
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      overallAssessment: "AI insights temporarily unavailable. Please try again later.",
      priorityIssues: [],
      fieldMappingSuggestions: [],
      nextSteps: []
    };
  }
}

function getBasicRecommendation(rule, finding) {
  const recommendations = {
    'TOTALS_BALANCE': 'Verify calculation: total_excl_vat + vat_amount = total_incl_vat',
    'LINE_MATH': `Check line ${finding.exampleLine || ''} calculation: qty × unit_price = line_total`,
    'DATE_ISO': 'Convert dates to YYYY-MM-DD format',
    'CURRENCY_ALLOWED': `Change currency to one of: AED, SAR, MYR, USD`,
    'TRN_PRESENT': 'Add missing tax registration numbers'
  };
  return recommendations[rule] || 'Please review and fix this validation error';
}

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

    // Generate AI insights
    const ruleFindings = rulesValidation.results.map(r => ({
      rule: r.ruleId,
      ok: r.passed,
      value: r.details?.value,
      exampleLine: r.exampleLine
    }));

    const coverage = {
      matches: fieldMapping.matches,
      close: fieldMapping.close,
      missing: fieldMapping.missing
    };

    const reportData = { scores };
    const aiInsights = await generateAiInsights(reportData, ruleFindings, coverage);

    // Generate report with AI insights
    const report = await reportService.generateReport(
      uploadId,
      processedData,
      fieldMapping,
      rulesValidation,
      scores,
      questionnaire,
      aiInsights
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

// GET /share/:reportId - Retrieve saved report for sharing
router.get('/share/:reportId', async (req, res) => {
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

// GET /share/:reportId/pdf - Export report as PDF
router.get('/share/:reportId/pdf', async (req, res) => {
  const { reportId } = req.params;

  if (!reportId) {
    return res.status(400).json({
      error: 'Missing report ID',
      message: 'Report ID is required'
    });
  }

  try {
    const report = await reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'The requested report was not found or has expired'
      });
    }

    console.log('Generating PDF for report:', reportId);

    // Use PDFKit for serverless-friendly PDF generation
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('E-Invoicing Readiness Report', 50, 50);
    doc.fontSize(12).text(`Report ID: ${reportId}`, 50, 80);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 95);

    // Add line separator
    doc.moveTo(50, 120).lineTo(550, 120).stroke();

    let yPosition = 140;

    // Scores section
    doc.fontSize(16).text('Summary', 50, yPosition);
    yPosition += 30;

    doc.fontSize(12);
    doc.text(`Readiness Score: ${report.readinessScore || 0}`, 50, yPosition);
    doc.text(`Field Coverage: ${report.fieldCoverage || 0}%`, 200, yPosition);
    doc.text(`Rules Passed: ${report.rulesPassed || 0}/${report.totalRules || 0}`, 350, yPosition);
    yPosition += 40;

    // Rules section
    doc.fontSize(16).text('Validation Rules', 50, yPosition);
    yPosition += 25;

    if (report.ruleFindings && report.ruleFindings.length > 0) {
      doc.fontSize(10);
      report.ruleFindings.forEach((rule, index) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        const status = rule.passed ? '✓ PASSED' : '✗ FAILED';
        doc.text(`${rule.ruleId || 'Unknown Rule'}: ${rule.description || 'No description'}`, 50, yPosition);
        doc.text(status, 450, yPosition);
        yPosition += 15;

        if (rule.issues && rule.issues.length > 0) {
          rule.issues.forEach(issue => {
            if (yPosition > 700) {
              doc.addPage();
              yPosition = 50;
            }
            doc.text(`  • ${issue}`, 70, yPosition);
            yPosition += 12;
          });
        }
        yPosition += 5;
      });
    }

    yPosition += 20;

    // Field Coverage section
    if (yPosition > 650) {
      doc.addPage();
      yPosition = 50;
    }

    doc.fontSize(16).text('Field Coverage', 50, yPosition);
    yPosition += 25;

    if (report.mappedFields && report.mappedFields.length > 0) {
      doc.fontSize(10);
      doc.text(`Mapped ${report.mappedFields.length} of ${report.totalRequiredFields || 0} required fields:`, 50, yPosition);
      yPosition += 20;

      report.mappedFields.forEach((field, index) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        const mapping = field.sourceField ? `${field.getsField} ← ${field.sourceField}` : `${field.getsField} (Not mapped)`;
        doc.text(mapping, 50, yPosition);

        if (field.sampleValue) {
          yPosition += 12;
          doc.text(`  Sample: ${field.sampleValue}`, 70, yPosition);
        }
        yPosition += 15;
      });
    }

    // AI Insights section
    if (report.aiInsights) {
      yPosition += 20;
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      doc.fontSize(16).text('AI Insights & Recommendations', 50, yPosition);
      yPosition += 25;

      doc.fontSize(10);
      if (report.aiInsights.overallAssessment) {
        doc.text('Overall Assessment:', 50, yPosition);
        yPosition += 15;
        const assessment = typeof report.aiInsights.overallAssessment === 'string'
          ? report.aiInsights.overallAssessment
          : JSON.stringify(report.aiInsights.overallAssessment);
        doc.text(assessment, 50, yPosition, { width: 500 });
        yPosition += doc.heightOfString(assessment, { width: 500 }) + 15;
      }

      if (report.aiInsights.priorityIssues && report.aiInsights.priorityIssues.length > 0) {
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        doc.text('Priority Issues:', 50, yPosition);
        yPosition += 15;

        report.aiInsights.priorityIssues.forEach(issue => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          const issueText = typeof issue === 'string' ? issue : JSON.stringify(issue);
          doc.text(`• ${issueText}`, 70, yPosition);
          yPosition += 15;
        });
      }

      if (report.aiInsights.nextSteps && report.aiInsights.nextSteps.length > 0) {
        yPosition += 10;
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }
        doc.text('Next Steps:', 50, yPosition);
        yPosition += 15;

        report.aiInsights.nextSteps.forEach(step => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          const stepText = typeof step === 'string' ? step : JSON.stringify(step);
          doc.text(`• ${stepText}`, 70, yPosition);
          yPosition += 15;
        });
      }
    }

    // Metadata section
    yPosition += 20;
    if (yPosition > 650) {
      doc.addPage();
      yPosition = 50;
    }

    doc.fontSize(16).text('Report Metadata', 50, yPosition);
    yPosition += 25;

    doc.fontSize(10);
    doc.text(`Original File: ${report.originalFileName || 'Unknown'}`, 50, yPosition);
    yPosition += 15;
    doc.text(`File Size: ${report.fileSize ? (report.fileSize / 1024).toFixed(2) + ' KB' : 'Unknown'}`, 50, yPosition);
    yPosition += 15;
    doc.text(`Records Processed: ${report.recordCount || 'Unknown'}`, 50, yPosition);
    yPosition += 15;
    doc.text(`Analysis Duration: ${report.processingTime || 'Unknown'}`, 50, yPosition);

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: 'Unable to generate PDF report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  try {
    report = await reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'The requested report was not found or has expired'
      });
    }

    console.log('Generating PDF for report:', reportId);

    const PDFDocument = require('pdfkit');

    try {
      // Create new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);

      // Pipe the PDF to the response
      doc.pipe(res);

      // Add title
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('E-Invoicing Readiness Report', { align: 'center' });

      doc.moveDown();

      // Add report metadata
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Report ID: ${reportId}`)
         .text(`Generated: ${new Date().toLocaleString()}`)
         .text(`Original File: ${report.originalFileName || 'Unknown'}`);

      doc.moveDown(2);

      // Add scores section
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Summary Scores');

      doc.fontSize(12)
         .font('Helvetica')
         .text(`Readiness Score: ${report.readinessScore || 0}`)
         .text(`Field Coverage: ${report.fieldCoverage || 0}%`)
         .text(`Rules Passed: ${report.rulesPassed || 0}/${report.totalRules || 0}`);

      doc.moveDown(2);

      // Add validation rules section
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Validation Rules');

      doc.moveDown();

      if (report.ruleFindings && report.ruleFindings.length > 0) {
        report.ruleFindings.forEach((rule, index) => {
          const status = rule.passed ? 'PASSED' : 'FAILED';
          const statusColor = rule.passed ? 'green' : 'red';

          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('black')
             .text(`${index + 1}. ${rule.ruleId || 'Unknown Rule'}: ${rule.description || 'No description'}`);

          doc.font('Helvetica')
             .fillColor(statusColor)
             .text(`Status: ${status}`);

          if (rule.issues && rule.issues.length > 0) {
            doc.fillColor('black')
               .text('Issues:');
            rule.issues.forEach(issue => {
              doc.text(`  • ${issue}`);
            });
          }

          doc.moveDown();
        });
      } else {
        doc.text('No validation rules found.');
      }

      doc.moveDown();

      // Add field coverage section
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('black')
         .text(`Field Coverage (${(report.mappedFields || []).length}/${report.totalRequiredFields || 0})`);

      doc.moveDown();

      if (report.mappedFields && report.mappedFields.length > 0) {
        report.mappedFields.forEach((field, index) => {
          doc.fontSize(12)
             .font('Helvetica')
             .text(`${index + 1}. ${field.getsField || 'Unknown Field'}`);

          if (field.sourceField) {
            doc.text(`   Mapped from: ${field.sourceField}`);
          }

          if (field.sampleValue) {
            doc.text(`   Sample: ${field.sampleValue}`);
          }

          doc.moveDown(0.5);
        });
      } else {
        doc.text('No mapped fields found.');
      }

      doc.moveDown();

      // Add AI insights section if available
      if (report.aiInsights) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('AI Insights & Recommendations');

        doc.moveDown();

        if (report.aiInsights.overallAssessment) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('Overall Assessment:');
          doc.font('Helvetica')
             .text(report.aiInsights.overallAssessment);
          doc.moveDown();
        }

        if (report.aiInsights.priorityIssues && report.aiInsights.priorityIssues.length > 0) {
          doc.font('Helvetica-Bold')
             .text('Priority Issues:');
          doc.font('Helvetica');
          report.aiInsights.priorityIssues.forEach(issue => {
            const issueText = typeof issue === 'string' ? issue : JSON.stringify(issue);
            doc.text(`• ${issueText}`);
          });
          doc.moveDown();
        }

        if (report.aiInsights.nextSteps && report.aiInsights.nextSteps.length > 0) {
          doc.font('Helvetica-Bold')
             .text('Next Steps:');
          doc.font('Helvetica');
          report.aiInsights.nextSteps.forEach(step => {
            const stepText = typeof step === 'string' ? step : JSON.stringify(step);
            doc.text(`• ${stepText}`);
          });
          doc.moveDown();
        }
      }

      // Add metadata section
      doc.addPage();
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Report Metadata');

      doc.moveDown();

      doc.fontSize(12)
         .font('Helvetica')
         .text(`File Size: ${report.fileSize ? (report.fileSize / 1024).toFixed(2) + ' KB' : 'Unknown'}`)
         .text(`Records Processed: ${report.recordCount || 'Unknown'}`)
         .text(`Analysis Duration: ${report.processingTime || 'Unknown'}`);

      // Finalize the PDF
      doc.end();

      console.log('PDF generated successfully with PDFKit');

    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({
        error: error.message,
        details: 'Failed to generate PDF report',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate PDF report',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// AI Insights endpoint
// POST /ai-insights - Generate AI-powered insights and recommendations
router.post('/ai-insights', async (req, res) => {
  try {
    const { reportData, ruleFindings, coverage } = req.body;

    if (!reportData) {
      return res.status(400).json({
        error: 'Missing report data',
        message: 'Report data is required for AI insights generation'
      });
    }

    // Generate AI insights using Gemini API
    const insights = await generateAiInsights(reportData, ruleFindings, coverage);

    res.json(insights);

  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate AI insights'
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
      environment: process.env.NODE_ENV || 'development',
      database: {
        type: 'postgres',
        status: dbConnected ? 'connected' : 'disconnected'
      }
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