const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

class ReportService {
  constructor() {
    this.expiryDays = process.env.REPORT_EXPIRY_DAYS || 7;
  }

  // Generate a complete analysis report
  async generateReport(uploadId, processedData, fieldMapping, rulesValidation, scores, questionnaire) {
    const reportId = `r_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    
    const report = {
      reportId,
      uploadId,
      meta: {
        version: "1.0",
        generated_at: new Date().toISOString(),
        expires_at: this.calculateExpiryDate(),
        db: "postgres",
        rows_analyzed: processedData.processedRows,
        total_rows: processedData.totalRows,
        truncated: processedData.truncated
      },
      scores: {
        overall: scores.overall,
        breakdown: {
          data: scores.data,
          coverage: scores.coverage,
          rules: scores.rules,
          posture: scores.posture
        },
        readiness: scores.readinessLevel,
        weights: {
          data: "25%",
          coverage: "35%",
          rules: "30%",
          posture: "10%"
        }
      },
      coverage: {
        summary: {
          total_fields: fieldMapping.matches.length + fieldMapping.close.length + fieldMapping.missing.length,
          matched: fieldMapping.matches.length,
          close: fieldMapping.close.length,
          missing: fieldMapping.missing.length
        },
        matches: fieldMapping.matches.map(m => ({
          gets_field: m.getsField,
          source_field: m.sourceField,
          confidence: Math.round(m.confidence * 100),
          required: m.required
        })),
        close: fieldMapping.close.map(c => ({
          gets_field: c.getsField,
          source_field: c.sourceField,
          confidence: Math.round(c.confidence * 100),
          required: c.required,
          suggestion: c.suggestion
        })),
        missing: fieldMapping.missing.map(m => ({
          gets_field: m.getsField,
          required: m.required,
          type: m.type
        }))
      },
      rules: {
        summary: {
          total_rules: rulesValidation.totalCount,
          passed: rulesValidation.passedCount,
          failed: rulesValidation.totalCount - rulesValidation.passedCount,
          score: rulesValidation.score
        },
        results: rulesValidation.results.map(r => ({
          rule_id: r.ruleId,
          name: r.name,
          passed: r.passed,
          description: r.description,
          details: r.details,
          example_line: r.exampleLine,
          suggestion: r.suggestion
        }))
      },
      questionnaire: {
        responses: questionnaire,
        score: scores.posture
      },
      recommendations: this.generateRecommendations(fieldMapping, rulesValidation, scores)
    };

    // Save report to database
    await this.saveReport(reportId, uploadId, report);

    return report;
  }

  // Save report to database
  async saveReport(reportId, uploadId, reportJson) {
    const expiresAt = this.calculateExpiryDate();
    
    try {
      await pool.query(
        `INSERT INTO reports (id, upload_id, scores_overall, report_json, expires_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [reportId, uploadId, reportJson.scores.overall, JSON.stringify(reportJson), expiresAt]
      );
    } catch (error) {
      console.error('Error saving report:', error);
      throw new Error('Failed to save report');
    }
  }

  // Retrieve report from database
  async getReport(reportId) {
    try {
      const result = await pool.query(
        'SELECT report_json FROM reports WHERE id = $1 AND expires_at > NOW()',
        [reportId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].report_json;
    } catch (error) {
      console.error('Error retrieving report:', error);
      throw new Error('Failed to retrieve report');
    }
  }

  // Get recent reports (P1 feature)
  async getRecentReports(limit = 10) {
    try {
      const result = await pool.query(
        `SELECT r.id, r.created_at, r.scores_overall, u.country, u.erp, u.rows_parsed
         FROM reports r
         LEFT JOIN uploads u ON r.upload_id = u.id
         WHERE r.expires_at > NOW()
         ORDER BY r.created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(row => ({
        reportId: row.id,
        createdAt: row.created_at,
        overallScore: row.scores_overall,
        country: row.country,
        erp: row.erp,
        rowsAnalyzed: row.rows_parsed
      }));
    } catch (error) {
      console.error('Error retrieving recent reports:', error);
      throw new Error('Failed to retrieve recent reports');
    }
  }

  // Calculate expiry date
  calculateExpiryDate() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(this.expiryDays));
    return expiryDate;
  }

  // Generate recommendations based on analysis results
  generateRecommendations(fieldMapping, rulesValidation, scores) {
    const recommendations = [];

    // Coverage recommendations
    if (scores.coverage < 70) {
      recommendations.push({
        category: "Field Mapping",
        priority: "High",
        title: "Improve Field Coverage",
        description: `Only ${fieldMapping.matches.length} out of ${fieldMapping.matches.length + fieldMapping.close.length + fieldMapping.missing.length} fields are properly mapped.`,
        action: "Review and map missing required fields to improve coverage score."
      });
    }

    if (fieldMapping.missing.length > 0) {
      const requiredMissing = fieldMapping.missing.filter(m => m.required);
      if (requiredMissing.length > 0) {
        recommendations.push({
          category: "Required Fields",
          priority: "High",
          title: "Add Missing Required Fields",
          description: `${requiredMissing.length} required field(s) are missing: ${requiredMissing.map(m => m.getsField).join(', ')}`,
          action: "Ensure all required fields are present in your data."
        });
      }
    }

    // Rules recommendations
    const failedRules = rulesValidation.results.filter(r => !r.passed);
    failedRules.forEach(rule => {
      recommendations.push({
        category: "Data Quality",
        priority: rule.ruleId === 'TRN_PRESENT' || rule.ruleId === 'CURRENCY_VALID' ? "High" : "Medium",
        title: `Fix ${rule.name}`,
        description: rule.details,
        action: rule.suggestion
      });
    });

    // Posture recommendations
    if (scores.posture < 60) {
      recommendations.push({
        category: "Implementation Readiness",
        priority: "Medium",
        title: "Improve Integration Capabilities",
        description: "Low posture score indicates limited integration readiness.",
        action: "Consider implementing webhooks, sandbox environment, and retry mechanisms."
      });
    }

    // Overall recommendations
    if (scores.overall < 60) {
      recommendations.push({
        category: "Overall Readiness",
        priority: "High",
        title: "Significant Improvements Required",
        description: `Overall readiness score of ${scores.overall}% indicates major gaps.`,
        action: "Address high-priority issues in field mapping and data quality before proceeding with e-invoicing implementation."
      });
    }

    return recommendations;
  }

  // Clean up expired reports (utility method)
  async cleanupExpiredReports() {
    try {
      const result = await pool.query(
        'DELETE FROM reports WHERE expires_at <= NOW()'
      );
      console.log(`Cleaned up ${result.rowCount} expired reports`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired reports:', error);
      throw new Error('Failed to cleanup expired reports');
    }
  }
}

module.exports = ReportService;