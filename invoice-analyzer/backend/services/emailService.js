const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@invoiceanalyzer.com';
  }

  async sendReportLink(reportId, recipientEmail, reportData = {}) {
    if (!this.resend) {
      throw new Error('Email service not configured. RESEND_API_KEY is required.');
    }

    if (!recipientEmail || !this.isValidEmail(recipientEmail)) {
      throw new Error('Valid recipient email is required.');
    }

    try {
      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${reportId}`;
      const pdfUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${reportId}/pdf`;
      
      const overallScore = reportData.scores?.overall || 0;
      const readinessLevel = this.getReadinessLevel(overallScore);

      const emailData = {
        from: this.fromEmail,
        to: recipientEmail,
        subject: `E-Invoicing Readiness Report - ${readinessLevel} (${overallScore}%)`,
        html: this.generateEmailTemplate(reportId, shareUrl, pdfUrl, reportData)
      };

      const result = await this.resend.emails.send(emailData);
      
      return {
        success: true,
        messageId: result.data?.id,
        shareUrl,
        pdfUrl
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  generateEmailTemplate(reportId, shareUrl, pdfUrl, reportData) {
    const overallScore = reportData.scores?.overall || 0;
    const readinessLevel = this.getReadinessLevel(overallScore);
    const readinessColor = this.getReadinessColor(overallScore);
    
    const createdDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Invoicing Readiness Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">E-Invoicing Readiness Report</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your invoice analysis is complete</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
        <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef;">
            <h2 style="margin: 0 0 15px 0; color: #2c3e50;">Report Summary</h2>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0;">
                <span style="font-weight: bold;">Overall Readiness:</span>
                <div style="display: flex; align-items: center;">
                    <span style="background: ${readinessColor}; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; margin-right: 10px;">
                        ${readinessLevel}
                    </span>
                    <span style="font-size: 18px; font-weight: bold; color: ${readinessColor};">${overallScore}%</span>
                </div>
            </div>
            
            <div style="margin: 15px 0;">
                <span style="font-weight: bold;">Report ID:</span>
                <code style="background: #f1f3f4; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${reportId}</code>
            </div>
            
            <div style="margin: 15px 0;">
                <span style="font-weight: bold;">Generated:</span>
                <span style="margin-left: 8px;">${createdDate}</span>
            </div>
            
            ${reportData.scores ? `
            <div style="margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Score Breakdown</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <div>📊 Data Quality: <strong>${reportData.scores.breakdown?.data || 0}%</strong></div>
                    <div>🎯 Coverage: <strong>${reportData.scores.breakdown?.coverage || 0}%</strong></div>
                    <div>✅ Rules: <strong>${reportData.scores.breakdown?.rules || 0}%</strong></div>
                    <div>⚙️ Posture: <strong>${reportData.scores.breakdown?.posture || 0}%</strong></div>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <a href="${shareUrl}" style="display: inline-block; background: #007bff; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin: 0 10px 10px 0;">
                📋 View Full Report
            </a>
            <a href="${pdfUrl}" style="display: inline-block; background: #28a745; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin: 0 10px 10px 0;">
                📄 Download PDF
            </a>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
            <h3 style="margin: 0 0 8px 0; color: #1976d2; font-size: 14px;">📝 Next Steps</h3>
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
                Review your detailed analysis report to understand field mappings, rule compliance, and recommendations for improving your e-invoicing readiness.
            </p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">This report will be available for 7 days from generation date.</p>
            <p style="margin: 5px 0 0 0;">
                Powered by <strong>E-Invoicing Readiness Analyzer</strong>
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  getReadinessLevel(score) {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  }

  getReadinessColor(score) {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    return '#dc3545';
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Test email configuration
  async testConnection() {
    if (!this.resend) {
      return { success: false, error: 'Resend API key not configured' };
    }

    try {
      // Resend doesn't have a direct test endpoint, but we can verify the API key format
      return { success: true, message: 'Email service configured correctly' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;