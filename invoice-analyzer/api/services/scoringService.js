const { SCORING_WEIGHTS, CATEGORY_WEIGHTS } = require('../config/schema');

class ScoringService {
  constructor() {
    this.weights = SCORING_WEIGHTS;
    this.categoryWeights = CATEGORY_WEIGHTS;
  }

  // Calculate overall scores for the analysis
  calculateScores(processedData, fieldMapping, rulesValidation, questionnaire) {
    const dataScore = this.calculateDataScore(processedData);
    const coverageScore = this.calculateCoverageScore(fieldMapping);
    const rulesScore = rulesValidation.score;
    const postureScore = this.calculatePostureScore(questionnaire);

    const overall = this.calculateOverallScore(dataScore, coverageScore, rulesScore, postureScore);

    return {
      data: dataScore,
      coverage: coverageScore,
      rules: rulesScore,
      posture: postureScore,
      overall,
      readinessLevel: this.getReadinessLevel(overall)
    };
  }

  // Calculate data processing score (25% weight)
  calculateDataScore(processedData) {
    const { processedRows, totalRows } = processedData;
    
    // Base score from successful parsing
    const parseScore = (processedRows / totalRows) * 100;
    
    // Bonus for data quality (check for empty/null values)
    let qualityBonus = 0;
    if (processedData.data && processedData.data.length > 0) {
      const totalFields = Object.keys(processedData.data[0]).length * processedRows;
      let filledFields = 0;
      
      processedData.data.forEach(row => {
        Object.values(row).forEach(value => {
          if (value !== null && value !== undefined && value !== '') {
            filledFields++;
          }
        });
      });
      
      qualityBonus = (filledFields / totalFields) * 10; // Up to 10 points bonus
    }

    return Math.round(Math.min(parseScore + qualityBonus, 100));
  }

  // Calculate coverage score (35% weight)
  calculateCoverageScore(fieldMapping) {
    const { matches, close, missing } = fieldMapping;
    
    // Group fields by category for weighted scoring
    const categoryScores = {};
    
    Object.keys(this.categoryWeights).forEach(category => {
      const categoryFields = this.getFieldsByCategory(category);
      const categoryMatches = matches.filter(m => categoryFields.includes(m.getsField));
      const categoryClose = close.filter(c => categoryFields.includes(c.getsField));
      const categoryMissing = missing.filter(m => categoryFields.includes(m.getsField));
      
      const totalInCategory = categoryFields.length;
      const matchScore = categoryMatches.length * 1.0;
      const closeScore = categoryClose.length * 0.6; // Close matches get 60% credit
      
      categoryScores[category] = totalInCategory > 0 
        ? ((matchScore + closeScore) / totalInCategory) * 100 
        : 100;
    });

    // Calculate weighted average
    let weightedScore = 0;
    Object.keys(this.categoryWeights).forEach(category => {
      weightedScore += categoryScores[category] * this.categoryWeights[category];
    });

    return Math.round(Math.min(weightedScore, 100));
  }

  // Calculate posture score from questionnaire (10% weight)
  calculatePostureScore(questionnaire) {
    if (!questionnaire) return 0;

    const { webhooks, sandbox_env, retries } = questionnaire;
    let score = 0;

    // Each positive answer contributes to readiness
    if (webhooks) score += 40;      // Webhook capability is important
    if (sandbox_env) score += 35;   // Sandbox environment shows testing readiness
    if (retries) score += 25;       // Retry mechanism shows robustness

    return Math.round(Math.min(score, 100));
  }

  // Calculate overall weighted score
  calculateOverallScore(dataScore, coverageScore, rulesScore, postureScore) {
    const overall = (
      dataScore * this.weights.data +
      coverageScore * this.weights.coverage +
      rulesScore * this.weights.rules +
      postureScore * this.weights.posture
    );

    return Math.round(overall);
  }

  // Get readiness level based on overall score
  getReadinessLevel(overallScore) {
    if (overallScore >= 80) {
      return {
        level: 'High',
        description: 'Ready for e-invoicing implementation',
        color: 'green'
      };
    } else if (overallScore >= 60) {
      return {
        level: 'Medium',
        description: 'Some improvements needed before implementation',
        color: 'orange'
      };
    } else {
      return {
        level: 'Low',
        description: 'Significant improvements required',
        color: 'red'
      };
    }
  }

  // Helper method to get fields by category
  getFieldsByCategory(category) {
    const { GETS_SCHEMA } = require('../config/schema');
    
    const categoryMap = {
      header: [
        'invoice.id',
        'invoice.issue_date',
        'invoice.currency',
        'invoice.total_excl_vat',
        'invoice.vat_amount',
        'invoice.total_incl_vat'
      ],
      seller: [
        'seller.name',
        'seller.trn',
        'seller.country',
        'seller.city'
      ],
      buyer: [
        'buyer.name',
        'buyer.trn',
        'buyer.country',
        'buyer.city'
      ],
      lines: [
        'lines[].sku',
        'lines[].description',
        'lines[].qty',
        'lines[].unit_price',
        'lines[].line_total'
      ]
    };

    return categoryMap[category] || [];
  }

  // Generate score breakdown for detailed reporting
  generateScoreBreakdown(scores, fieldMapping, rulesValidation) {
    return {
      summary: {
        overall: scores.overall,
        readiness: scores.readinessLevel,
        breakdown: {
          data: { score: scores.data, weight: '25%', description: 'Data parsing and quality' },
          coverage: { score: scores.coverage, weight: '35%', description: 'Field mapping coverage' },
          rules: { score: scores.rules, weight: '30%', description: 'Validation rules compliance' },
          posture: { score: scores.posture, weight: '10%', description: 'Implementation readiness' }
        }
      },
      details: {
        fieldCoverage: {
          matched: fieldMapping.matches.length,
          close: fieldMapping.close.length,
          missing: fieldMapping.missing.length,
          total: fieldMapping.matches.length + fieldMapping.close.length + fieldMapping.missing.length
        },
        rulesCompliance: {
          passed: rulesValidation.passedCount,
          failed: rulesValidation.totalCount - rulesValidation.passedCount,
          total: rulesValidation.totalCount
        }
      }
    };
  }
}

module.exports = ScoringService;