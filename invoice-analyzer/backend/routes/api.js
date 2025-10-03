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

  let report;
  try {
    report = await reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'The requested report was not found or has expired'
      });
    }

    console.log('Generating PDF for report:', reportId);

    // Generate PDF using Puppeteer by navigating to the frontend page
    const puppeteer = require('puppeteer');
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });

      const page = await browser.newPage();

      // Set viewport for better rendering
      await page.setViewport({ width: 1200, height: 800 });

      // Navigate to the share page
      const shareUrl = `https://complyance-internship-assignment.vercel.app/share/${reportId}`;
      console.log('Navigating to:', shareUrl);

      const response = await page.goto(shareUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load page: ${response ? response.status() : 'No response'}`);
      }

      console.log('Page loaded successfully');

      // Wait for content to load with a more robust check
      try {
        await page.waitForFunction(() => {
          const hasContent = document.querySelector('.MuiPaper-root') ||
                           document.querySelector('[class*="MuiCard"]') ||
                           document.querySelector('[class*="results"]');
          console.log('Checking for content:', !!hasContent);
          return hasContent;
        }, { timeout: 15000 });
        console.log('Content found on page');
      } catch (waitError) {
        console.log('Wait timeout, but continuing with PDF generation');
      }

      // Wait a bit more for any async data loading
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Hide navigation and non-essential elements for PDF
      await page.addStyleTag({
        content: `
          /* Hide navigation */
          .MuiAppBar-root { display: none !important; }

          /* Hide buttons */
          button { display: none !important; }

          /* Better PDF styling */
          body {
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
          }

          .MuiContainer-root {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .MuiPaper-root {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
          }

          /* Ensure text is readable in PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Hide loading spinners */
          .MuiCircularProgress-root {
            display: none !important;
          }
        `
      });

      // Generate PDF
      console.log('Generating PDF...');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        preferCSSPageSize: true
      });

      console.log('PDF generated successfully');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);
      res.send(pdf);

    } finally {
      if (browser) {
        await browser.close();
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);
    res.send(pdf);

  } catch (error) {
    console.error('PDF generation error:', error);

    // Fallback: Try to generate PDF from report data directly
    try {
      console.log('Attempting fallback PDF generation...');

      if (!report) {
        throw new Error('Report data not available for fallback PDF generation');
      }

      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Create a simple HTML representation of the report
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Invoice Analysis Report - ${reportId}</title>
          <style>
              body {
                  font-family: 'Segoe UI', Arial, sans-serif;
                  margin: 20px;
                  color: #333;
                  line-height: 1.6;
              }
              .header {
                  text-align: center;
                  border-bottom: 2px solid #1976d2;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
              }
              .score-grid {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 20px;
                  margin: 30px 0;
              }
              .score-card {
                  text-align: center;
                  padding: 20px;
                  background: #f8f9fa;
                  border-radius: 8px;
              }
              .score-value {
                  font-size: 2.5em;
                  font-weight: bold;
                  color: #1976d2;
                  margin-bottom: 10px;
              }
              .section {
                  margin: 30px 0;
              }
              .section h2 {
                  color: #1976d2;
                  border-bottom: 1px solid #ddd;
                  padding-bottom: 10px;
              }
              .rule-item {
                  padding: 15px;
                  margin: 10px 0;
                  border-left: 4px solid #ddd;
                  background: #fafafa;
              }
              .rule-passed {
                  border-left-color: #4caf50;
                  background: #f1f8e9;
              }
              .rule-failed {
                  border-left-color: #f44336;
                  background: #ffebee;
              }
              .field-item {
                  padding: 10px;
                  margin: 5px 0;
                  background: #e3f2fd;
                  border-left: 4px solid #2196f3;
              }
              .metadata {
                  background: #f5f5f5;
                  padding: 20px;
                  border-radius: 8px;
                  margin-top: 30px;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>E-Invoicing Readiness Report</h1>
              <p><strong>Report ID:</strong> ${reportId}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="score-grid">
              <div class="score-card">
                  <div class="score-value">${report.readinessScore || 0}</div>
                  <div>Readiness Score</div>
              </div>
              <div class="score-card">
                  <div class="score-value">${report.fieldCoverage || 0}%</div>
                  <div>Field Coverage</div>
              </div>
              <div class="score-card">
                  <div class="score-value">${report.rulesPassed || 0}/${report.totalRules || 0}</div>
                  <div>Rules Passed</div>
              </div>
          </div>

          <div class="section">
              <h2>Validation Rules</h2>
              ${(report.ruleFindings || []).map(rule => `
                  <div class="rule-item ${rule.passed ? 'rule-passed' : 'rule-failed'}">
                      <strong>${rule.ruleId || 'Unknown Rule'}:</strong> ${rule.description || 'No description'}
                      <br><em>Status: ${rule.passed ? 'PASSED' : 'FAILED'}</em>
                      ${rule.issues && rule.issues.length > 0 ? `
                          <br><strong>Issues:</strong><br>
                          ${rule.issues.map(issue => `• ${issue}`).join('<br>')}
                      ` : ''}
                  </div>
              `).join('')}
          </div>

          <div class="section">
              <h2>Field Coverage (${(report.mappedFields || []).length}/${report.totalRequiredFields || 0})</h2>
              ${(report.mappedFields || []).map(field => `
                  <div class="field-item">
                      <strong>${field.getsField || 'Unknown Field'}</strong>
                      ${field.sourceField ? ` ← ${field.sourceField}` : ' (Not mapped)'}
                      ${field.sampleValue ? `<br><em>Sample: ${field.sampleValue}</em>` : ''}
                  </div>
              `).join('')}
          </div>

          ${report.aiInsights ? `
              <div class="section">
                  <h2>AI Insights & Recommendations</h2>
                  <p><strong>Overall Assessment:</strong> ${report.aiInsights.overallAssessment || 'No assessment available'}</p>

                  ${report.aiInsights.priorityIssues && report.aiInsights.priorityIssues.length > 0 ? `
                      <h3>Priority Issues:</h3>
                      ${report.aiInsights.priorityIssues.map(issue => `<p>• ${typeof issue === 'string' ? issue : JSON.stringify(issue)}</p>`).join('')}
                  ` : ''}

                  ${report.aiInsights.nextSteps && report.aiInsights.nextSteps.length > 0 ? `
                      <h3>Next Steps:</h3>
                      ${report.aiInsights.nextSteps.map(step => `<p>• ${typeof step === 'string' ? step : JSON.stringify(step)}</p>`).join('')}
                  ` : ''}
              </div>
          ` : ''}

          <div class="metadata">
              <h2>Report Metadata</h2>
              <p><strong>Original File:</strong> ${report.originalFileName || 'Unknown'}</p>
              <p><strong>File Size:</strong> ${report.fileSize ? (report.fileSize / 1024).toFixed(2) + ' KB' : 'Unknown'}</p>
              <p><strong>Records Processed:</strong> ${report.recordCount || 'Unknown'}</p>
              <p><strong>Analysis Duration:</strong> ${report.processingTime || 'Unknown'}</p>
          </div>
      </body>
      </html>`;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();

      console.log('Fallback PDF generated successfully');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);
      res.send(pdf);

    } catch (fallbackError) {
      console.error('Fallback PDF generation also failed:', fallbackError);
      res.status(500).json({
        error: error.message,
        details: 'Failed to generate PDF report',
        fallbackError: fallbackError.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});// GET /reports - Get recent reports (P1 feature)
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