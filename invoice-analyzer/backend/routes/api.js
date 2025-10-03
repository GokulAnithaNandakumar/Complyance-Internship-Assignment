const express = require('express');
const multer = require('multer');
const UploadService = require('../services/uploadService');
const FieldMapper = require('../services/fieldMapper');
const RulesValidator = require('../services/rulesValidator');
const ScoringService = require('../services/scoringService');
const ReportService = require('../services/reportService');
const dataStore = require('../services/dataStore');
const emailService = require('../services/emailService');

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

    // Save report to persistent storage (required by PRD)
    await dataStore.saveReport(report);

    res.json(report);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to analyze uploaded data'
    });
  }
});

// GET /report/:reportId - Retrieve saved report JSON (required by PRD)
router.get('/report/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({
        error: 'Missing report ID',
        message: 'Report ID is required'
      });
    }

    const report = await dataStore.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found with ID: ${reportId}`
      });
    }

    // Return the raw report JSON as specified in PRD
    res.json(report);
    
  } catch (error) {
    console.error('Report retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve report',
      message: error.message
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

// GET /share/:reportId/pdf - Export report as PDF (Fixed Layout)
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

    // Generate PDF using PDFKit with fixed layout
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Collect PDF data in memory
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-analysis-${reportId}.pdf"`);
      res.send(pdfData);
    });

    // PDF Content Generation with fixed spacing
    try {
      let y = 60;
      const pageWidth = 515; // A4 width minus margins

      // Header Section
      doc.fontSize(22).fillColor('#1976d2').text(`Analysis Report - ${reportId}`, 40, y);
      y += 35;

      doc.fontSize(16).fillColor('#333').text('Analysis Results', 40, y);
      y += 45;

      // Large Overall Score
      if (report.scores && report.scores.overall !== undefined) {
        const scoreColor = report.scores.overall >= 80 ? '#4caf50' :
                          report.scores.overall >= 60 ? '#ff9800' : '#f44336';

        doc.fontSize(64).fillColor(scoreColor).text(`${report.scores.overall}`, 40, y);
        doc.fontSize(16).fillColor('#333').text('Overall Readiness Score', 150, y + 20);

        // Readiness Level
        const readinessLevel = report.scores.readiness?.level || 'Unknown';
        doc.fontSize(14).fillColor('#666').text(readinessLevel, 150, y + 40);
        y += 85;
      }

      // Score Breakdown - 2x2 Grid with proper spacing
      if (report.scores && report.scores.breakdown) {
        const breakdown = report.scores.breakdown;
        const weights = report.scores.weights || {};
        const boxWidth = 230;
        const boxHeight = 75;
        const spacing = 25;

        // Data Quality (Top Left)
        doc.rect(40, y, boxWidth, boxHeight).fillAndStroke('#f8f9fa', '#e9ecef');
        doc.fontSize(12).fillColor('#333').text('Data Quality', 50, y + 8);
        doc.fontSize(24).fillColor('#1976d2').text(`${breakdown.data}%`, 50, y + 25);
        doc.fontSize(9).fillColor('#666').text(`Data parsing & type validation (${weights.data || '25%'})`, 50, y + 52, { width: boxWidth - 20 });

        // Rules (Top Right)
        doc.rect(40 + boxWidth + spacing, y, boxWidth, boxHeight).fillAndStroke('#f8f9fa', '#e9ecef');
        doc.fontSize(12).fillColor('#333').text('Rules', 50 + boxWidth + spacing, y + 8);
        doc.fontSize(24).fillColor('#1976d2').text(`${breakdown.rules}%`, 50 + boxWidth + spacing, y + 25);
        doc.fontSize(9).fillColor('#666').text(`Business rule validation (${weights.rules || '30%'})`, 50 + boxWidth + spacing, y + 52, { width: boxWidth - 20 });

        y += boxHeight + 15;

        // Coverage (Bottom Left)
        doc.rect(40, y, boxWidth, boxHeight).fillAndStroke('#f8f9fa', '#e9ecef');
        doc.fontSize(12).fillColor('#333').text('Coverage', 50, y + 8);
        doc.fontSize(24).fillColor('#1976d2').text(`${breakdown.coverage}%`, 50, y + 25);
        doc.fontSize(9).fillColor('#666').text(`Field mapping to GETS schema (${weights.coverage || '35%'})`, 50, y + 52, { width: boxWidth - 20 });

        // Posture (Bottom Right)
        doc.rect(40 + boxWidth + spacing, y, boxWidth, boxHeight).fillAndStroke('#f8f9fa', '#e9ecef');
        doc.fontSize(12).fillColor('#333').text('Posture', 50 + boxWidth + spacing, y + 8);
        doc.fontSize(24).fillColor('#1976d2').text(`${breakdown.posture}%`, 50 + boxWidth + spacing, y + 25);
        doc.fontSize(9).fillColor('#666').text(`Technical readiness (${weights.posture || '10%'})`, 50 + boxWidth + spacing, y + 52, { width: boxWidth - 20 });

        y += boxHeight + 35;
      }

      // Field Coverage Analysis
      if (report.coverage && report.coverage.summary) {
        doc.fontSize(16).fillColor('#333').text('Field Coverage Analysis', 40, y);
        y += 30;

        const summary = report.coverage.summary;
        const coverageBoxWidth = 140;
        const coverageBoxHeight = 80;
        const coverageSpacing = 25;

        // Matched
        doc.rect(40, y, coverageBoxWidth, coverageBoxHeight).fillAndStroke('#e8f5e8', '#4caf50');
        doc.fontSize(28).fillColor('#333').text(`${summary.matched}`, 40 + coverageBoxWidth/2 - 15, y + 20);
        doc.fontSize(12).fillColor('#333').text('Matched', 40 + coverageBoxWidth/2 - 25, y + 55);

        // Close Match
        doc.rect(40 + coverageBoxWidth + coverageSpacing, y, coverageBoxWidth, coverageBoxHeight).fillAndStroke('#fff3e0', '#ff9800');
        doc.fontSize(28).fillColor('#333').text(`${summary.close}`, 40 + coverageBoxWidth + coverageSpacing + coverageBoxWidth/2 - 15, y + 20);
        doc.fontSize(12).fillColor('#333').text('Close Match', 40 + coverageBoxWidth + coverageSpacing + coverageBoxWidth/2 - 35, y + 55);

        // Missing
        doc.rect(40 + 2*(coverageBoxWidth + coverageSpacing), y, coverageBoxWidth, coverageBoxHeight).fillAndStroke('#ffebee', '#f44336');
        doc.fontSize(28).fillColor('#333').text(`${summary.missing}`, 40 + 2*(coverageBoxWidth + coverageSpacing) + coverageBoxWidth/2 - 15, y + 20);
        doc.fontSize(12).fillColor('#333').text('Missing', 40 + 2*(coverageBoxWidth + coverageSpacing) + coverageBoxWidth/2 - 25, y + 55);

        y += coverageBoxHeight + 35;

        // Field Details
        if (report.coverage.matches && report.coverage.matches.length > 0) {
          doc.fontSize(14).fillColor('#333').text('Key Matched Fields:', 40, y);
          y += 20;

          report.coverage.matches.slice(0, 8).forEach(match => {
            if (y > 700) {
              doc.addPage();
              y = 60;
            }
            doc.fontSize(10).fillColor('#4caf50').text(`✓ ${match.gets_field} ← ${match.source_field} (${match.confidence}%)`, 50, y);
            y += 15;
          });
          y += 15;
        }

        if (report.coverage.missing && report.coverage.missing.length > 0) {
          doc.fontSize(14).fillColor('#333').text('Missing Required Fields:', 40, y);
          y += 20;

          report.coverage.missing.slice(0, 8).forEach(missing => {
            if (y > 700) {
              doc.addPage();
              y = 60;
            }
            doc.fontSize(10).fillColor('#f44336').text(`✗ ${missing.gets_field} (${missing.type})`, 50, y);
            y += 15;
          });
          y += 15;
        }

        if (report.coverage.close && report.coverage.close.length > 0) {
          doc.fontSize(14).fillColor('#333').text('Close Matches (Need Review):', 40, y);
          y += 20;

          report.coverage.close.slice(0, 6).forEach(close => {
            if (y > 700) {
              doc.addPage();
              y = 60;
            }
            doc.fontSize(10).fillColor('#ff9800').text(`? ${close.gets_field} ← ${close.source_field} (${close.confidence}%)`, 50, y);
            y += 15;
          });
          y += 25;
        }
      }

      // Validation Results Section
      if (y > 600) {
        doc.addPage();
        y = 60;
      }

      if (report.rules) {
        const rules = report.rules;
        doc.fontSize(18).fillColor('#333').text(`Validation Results (${rules.summary.passed}/${rules.summary.total_rules} Passing)`, 40, y);
        y += 40;

        // Display each rule with improved formatting
        if (rules.results && rules.results.length > 0) {
          rules.results.forEach((rule) => {
            if (y > 650) {
              doc.addPage();
              y = 60;
            }

            // Rule container
            const ruleHeight = rule.passed ? 80 : 110;
            doc.rect(40, y, pageWidth, ruleHeight).fillAndStroke('#fafafa', '#e0e0e0');

            // Rule name
            doc.fontSize(13).fillColor('#333').text(rule.name, 50, y + 10);
            doc.fontSize(10).fillColor('#666').text(rule.description, 50, y + 30, { width: 350 });

            // Status indicator
            if (rule.passed) {
              doc.fontSize(12).fillColor('#4caf50').text('PASS', 420, y + 15);
              doc.fontSize(16).fillColor('#4caf50').text('✓', 470, y + 12);
            } else {
              doc.fontSize(12).fillColor('#f44336').text('FAIL', 420, y + 15);
              doc.fontSize(16).fillColor('#f44336').text('✗', 470, y + 12);

              // Error details
              if (rule.details) {
                doc.fontSize(9).fillColor('#f44336').text(`${rule.details}`, 50, y + 50, { width: 350 });
              }

              // Solution
              if (rule.suggestion) {
                doc.fontSize(9).fillColor('#333').text(`Solution: ${rule.suggestion}`, 50, y + 70, { width: 350 });
              }
            }

            y += ruleHeight + 15;
          });
        }
      }

      // AI Insights Section
      if (report.aiInsights && report.aiInsights.overallAssessment !== "AI insights are not available for this report.") {
        // Add new page if needed
        if (y > 450) {
          doc.addPage();
          y = 60;
        }

        doc.fontSize(18).fillColor('#333').text('AI-Powered Insights & Recommendations', 40, y);
        y += 35;

        // Overall Assessment
        doc.fontSize(14).fillColor('#333').text('Overall Assessment', 40, y);
        y += 20;
        doc.fontSize(10).fillColor('#666').text(report.aiInsights.overallAssessment, 40, y, { width: pageWidth, lineGap: 2 });
        y += Math.ceil(report.aiInsights.overallAssessment.length / 80) * 12 + 25;

        // Priority Issues
        if (report.aiInsights.priorityIssues && report.aiInsights.priorityIssues.length > 0) {
          if (y > 600) {
            doc.addPage();
            y = 60;
          }

          doc.fontSize(14).fillColor('#333').text('Priority Issues to Fix', 40, y);
          y += 25;

          report.aiInsights.priorityIssues.slice(0, 5).forEach((issue, index) => {
            if (y > 650) {
              doc.addPage();
              y = 60;
            }

            // Issue title
            const issueText = typeof issue === 'object' ? (issue.issue || issue.title || `Priority Issue ${index + 1}`) : issue;
            const recommendationText = typeof issue === 'object' ? (issue.recommendation || issue.description || '') : '';

            doc.fontSize(11).fillColor('#f44336').text(issueText, 40, y, { width: pageWidth });
            y += 18;

            if (recommendationText) {
              doc.fontSize(10).fillColor('#666').text(recommendationText, 40, y, { width: pageWidth, lineGap: 1 });
              y += Math.ceil(recommendationText.length / 100) * 12 + 20;
            }
          });

          y += 15;
        }

        // Field Mapping Suggestions
        if (report.aiInsights.fieldMappingSuggestions && report.aiInsights.fieldMappingSuggestions.length > 0) {
          if (y > 600) {
            doc.addPage();
            y = 60;
          }

          doc.fontSize(14).fillColor('#333').text('Field Mapping Suggestions', 40, y);
          y += 25;

          report.aiInsights.fieldMappingSuggestions.slice(0, 5).forEach((suggestion, index) => {
            if (y > 650) {
              doc.addPage();
              y = 60;
            }

            // Mapping suggestion
            const mappingText = typeof suggestion === 'object' ? 
              (suggestion.mapping || suggestion.field || `Mapping ${index + 1}`) : suggestion;
            const rationaleText = typeof suggestion === 'object' ? 
              (suggestion.rationale || suggestion.description || '') : '';
            const priorityText = typeof suggestion === 'object' ? 
              (suggestion.priority || 'Medium') : 'Medium';

            doc.fontSize(11).fillColor('#2196f3').text(`${mappingText}`, 40, y, { width: pageWidth });
            y += 18;

            if (rationaleText) {
              doc.fontSize(10).fillColor('#666').text(rationaleText, 40, y, { width: pageWidth, lineGap: 1 });
              y += Math.ceil(rationaleText.length / 100) * 12 + 10;
            }

            // Priority indicator
            const priorityColor = priorityText.toLowerCase() === 'high' ? '#f44336' : 
                                priorityText.toLowerCase() === 'medium' ? '#ff9800' : '#4caf50';
            doc.fontSize(9).fillColor(priorityColor).text(`Priority: ${priorityText}`, 40, y, { width: pageWidth });
            y += 20;
          });

          y += 15;
        }

        // Recommended Next Steps
        if (report.aiInsights.nextSteps && report.aiInsights.nextSteps.length > 0) {
          if (y > 550) {
            doc.addPage();
            y = 60;
          }

          doc.fontSize(14).fillColor('#333').text('Recommended Next Steps', 40, y);
          y += 25;

          report.aiInsights.nextSteps.slice(0, 5).forEach((step, index) => {
            if (y > 650) {
              doc.addPage();
              y = 60;
            }

            const stepText = typeof step === 'object' ? (step.step || step.action || step.title || `Step ${index + 1}`) : step;
            doc.fontSize(10).fillColor('#333').text(`${index + 1}. ${stepText}`, 40, y, { width: pageWidth, lineGap: 1 });
            y += Math.ceil(stepText.length / 100) * 12 + 15;
          });
        }
      }

      // Footer with page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(9).fillColor('#999')
           .text(`Page ${i - range.start + 1} of ${range.count}`, 40, doc.page.height - 30);
        doc.text('Generated by E-Invoicing Readiness Analyzer', 300, doc.page.height - 30);
      }

      doc.end();

    } catch (error) {
      console.error('PDF generation error:', error);
      doc.end();
      return res.status(500).json({
        error: 'PDF generation failed',
        message: error.message
      });
    }

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message
    });
  }
});

// GET /reports - Get recent reports (P1 feature)
router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 reports
    const reports = await dataStore.getRecentReports(limit);

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

// POST /share/:reportId/email - Email report link (P1 feature)
router.post('/share/:reportId/email', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { email } = req.body;

    if (!reportId) {
      return res.status(400).json({
        error: 'Missing report ID',
        message: 'Report ID is required'
      });
    }

    if (!email) {
      return res.status(400).json({
        error: 'Missing email address',
        message: 'Email address is required'
      });
    }

    // Get the report data for email content
    const report = await dataStore.getReport(reportId);
    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found with ID: ${reportId}`
      });
    }

    // Send email with report link
    const result = await emailService.sendReportLink(reportId, email, report);

    res.json({
      success: true,
      message: 'Report link sent successfully',
      email: email,
      reportId: reportId,
      messageId: result.messageId,
      shareUrl: result.shareUrl,
      pdfUrl: result.pdfUrl
    });

  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message
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