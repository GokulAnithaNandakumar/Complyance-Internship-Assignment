const { flattenObject } = require('../utils/dataProcessor');

class RulesValidator {
  constructor() {
    this.rules = [
      {
        id: 'TOTALS_BALANCE',
        name: 'Totals Balance Check',
        description: 'Verify that total_excl_vat + vat_amount = total_incl_vat',
        validate: this.validateTotalsBalance.bind(this)
      },
      {
        id: 'LINE_MATH',
        name: 'Line Item Math Check',
        description: 'Verify that line_total = qty × unit_price for each line',
        validate: this.validateLineMath.bind(this)
      },
      {
        id: 'DATE_ISO',
        name: 'ISO Date Format Check',
        description: 'Verify that invoice dates are in YYYY-MM-DD format',
        validate: this.validateDateISO.bind(this)
      },
      {
        id: 'CURRENCY_VALID',
        name: 'Valid Currency Check',
        description: 'Verify that currency is one of: AED, SAR, MYR, USD',
        validate: this.validateCurrency.bind(this)
      },
      {
        id: 'TRN_PRESENT',
        name: 'TRN Presence Check',
        description: 'Verify that both buyer and seller TRN are non-empty',
        validate: this.validateTRNPresence.bind(this)
      }
    ];
  }

  // Validate all rules against the data
  validateRules(data, fieldMapping) {
    const results = this.rules.map(rule => {
      const result = rule.validate(data, fieldMapping);
      return {
        ruleId: rule.id,
        name: rule.name,
        description: rule.description,
        passed: result.passed,
        details: result.details,
        exampleLine: result.exampleLine,
        suggestion: this.getSuggestion(rule.id, result.passed)
      };
    });

    const passedCount = results.filter(r => r.passed).length;
    const score = Math.round((passedCount / this.rules.length) * 100);

    return {
      score,
      results,
      passedCount,
      totalCount: this.rules.length
    };
  }

  // Rule 1: TOTALS_BALANCE - total_excl_vat + vat_amount = total_incl_vat (±0.01)
  validateTotalsBalance(data, fieldMapping) {
    const { matches } = fieldMapping;
    
    const totalExclField = this.findMappedField('invoice.total_excl_vat', matches);
    const vatAmountField = this.findMappedField('invoice.vat_amount', matches);
    const totalInclField = this.findMappedField('invoice.total_incl_vat', matches);

    if (!totalExclField || !vatAmountField || !totalInclField) {
      return {
        passed: false,
        details: 'Required fields for total balance check not found',
        exampleLine: null
      };
    }

    let passedCount = 0;
    let totalCount = 0;
    let exampleLine = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const flattened = flattenObject(row);
      
      const totalExcl = parseFloat(flattened[totalExclField]) || 0;
      const vatAmount = parseFloat(flattened[vatAmountField]) || 0;
      const totalIncl = parseFloat(flattened[totalInclField]) || 0;

      const calculated = totalExcl + vatAmount;
      const difference = Math.abs(calculated - totalIncl);

      totalCount++;
      if (difference <= 0.01) {
        passedCount++;
      } else if (!exampleLine) {
        exampleLine = {
          row: i + 1,
          expected: calculated.toFixed(2),
          actual: totalIncl.toFixed(2),
          difference: difference.toFixed(2)
        };
      }
    }

    return {
      passed: passedCount === totalCount,
      details: `${passedCount}/${totalCount} rows passed totals balance check`,
      exampleLine
    };
  }

  // Rule 2: LINE_MATH - line_total = qty × unit_price (±0.01)
  validateLineMath(data, fieldMapping) {
    const { matches } = fieldMapping;
    
    const qtyField = this.findMappedField('lines[].qty', matches);
    const priceField = this.findMappedField('lines[].unit_price', matches);
    const totalField = this.findMappedField('lines[].line_total', matches);

    if (!qtyField || !priceField || !totalField) {
      return {
        passed: false,
        details: 'Required fields for line math check not found',
        exampleLine: null
      };
    }

    let passedCount = 0;
    let totalCount = 0;
    let exampleLine = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Handle both nested lines and flattened structure
      const lines = row.lines || [row];
      
      for (const line of lines) {
        const flattened = flattenObject(line);
        
        const qty = parseFloat(flattened[qtyField.replace('lines[].', '')] || flattened[qtyField]) || 0;
        const price = parseFloat(flattened[priceField.replace('lines[].', '')] || flattened[priceField]) || 0;
        const lineTotal = parseFloat(flattened[totalField.replace('lines[].', '')] || flattened[totalField]) || 0;

        const calculated = qty * price;
        const difference = Math.abs(calculated - lineTotal);

        totalCount++;
        if (difference <= 0.01) {
          passedCount++;
        } else if (!exampleLine) {
          exampleLine = {
            row: i + 1,
            qty,
            price,
            expected: calculated.toFixed(2),
            actual: lineTotal.toFixed(2),
            difference: difference.toFixed(2)
          };
        }
      }
    }

    return {
      passed: passedCount === totalCount,
      details: `${passedCount}/${totalCount} line items passed math check`,
      exampleLine
    };
  }

  // Rule 3: DATE_ISO - invoice.issue_date matches YYYY-MM-DD
  validateDateISO(data, fieldMapping) {
    const { matches } = fieldMapping;
    
    const dateField = this.findMappedField('invoice.issue_date', matches);

    if (!dateField) {
      return {
        passed: false,
        details: 'Invoice date field not found',
        exampleLine: null
      };
    }

    let passedCount = 0;
    let totalCount = 0;
    let exampleLine = null;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const flattened = flattenObject(row);
      const dateValue = flattened[dateField];

      totalCount++;
      if (dateValue && isoDateRegex.test(dateValue)) {
        // Additional validation to ensure it's a valid date
        const date = new Date(dateValue);
        if (!isNaN(date.getTime()) && dateValue === date.toISOString().split('T')[0]) {
          passedCount++;
        } else if (!exampleLine) {
          exampleLine = {
            row: i + 1,
            value: dateValue,
            issue: 'Invalid date despite correct format'
          };
        }
      } else if (!exampleLine) {
        exampleLine = {
          row: i + 1,
          value: dateValue,
          issue: 'Not in YYYY-MM-DD format'
        };
      }
    }

    return {
      passed: passedCount === totalCount,
      details: `${passedCount}/${totalCount} rows have valid ISO dates`,
      exampleLine
    };
  }

  // Rule 4: CURRENCY_VALID - currency is AED, SAR, MYR, or USD
  validateCurrency(data, fieldMapping) {
    const { matches } = fieldMapping;
    
    const currencyField = this.findMappedField('invoice.currency', matches);

    if (!currencyField) {
      return {
        passed: false,
        details: 'Currency field not found',
        exampleLine: null
      };
    }

    const validCurrencies = ['AED', 'SAR', 'MYR', 'USD'];
    let passedCount = 0;
    let totalCount = 0;
    let exampleLine = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const flattened = flattenObject(row);
      const currency = flattened[currencyField];

      totalCount++;
      if (currency && validCurrencies.includes(currency.toUpperCase())) {
        passedCount++;
      } else if (!exampleLine) {
        exampleLine = {
          row: i + 1,
          value: currency,
          validOptions: validCurrencies.join(', ')
        };
      }
    }

    return {
      passed: passedCount === totalCount,
      details: `${passedCount}/${totalCount} rows have valid currency`,
      exampleLine
    };
  }

  // Rule 5: TRN_PRESENT - buyer.trn and seller.trn non-empty
  validateTRNPresence(data, fieldMapping) {
    const { matches } = fieldMapping;
    
    const buyerTrnField = this.findMappedField('buyer.trn', matches);
    const sellerTrnField = this.findMappedField('seller.trn', matches);

    if (!buyerTrnField || !sellerTrnField) {
      return {
        passed: false,
        details: 'TRN fields not found',
        exampleLine: null
      };
    }

    let passedCount = 0;
    let totalCount = 0;
    let exampleLine = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const flattened = flattenObject(row);
      
      const buyerTrn = flattened[buyerTrnField];
      const sellerTrn = flattened[sellerTrnField];

      totalCount++;
      if (buyerTrn && sellerTrn && String(buyerTrn).trim() && String(sellerTrn).trim()) {
        passedCount++;
      } else if (!exampleLine) {
        exampleLine = {
          row: i + 1,
          buyerTrn: buyerTrn || 'empty',
          sellerTrn: sellerTrn || 'empty'
        };
      }
    }

    return {
      passed: passedCount === totalCount,
      details: `${passedCount}/${totalCount} rows have both TRNs present`,
      exampleLine
    };
  }

  // Helper method to find mapped field
  findMappedField(getsPath, matches) {
    const match = matches.find(m => m.getsField === getsPath);
    return match ? match.sourceField : null;
  }

  // Get suggestion for failed rules
  getSuggestion(ruleId, passed) {
    if (passed) return null;

    const suggestions = {
      'TOTALS_BALANCE': 'Ensure total_incl_vat = total_excl_vat + vat_amount',
      'LINE_MATH': 'Verify line_total = quantity × unit_price for each line item',
      'DATE_ISO': 'Use ISO dates like 2025-01-31 (YYYY-MM-DD format)',
      'CURRENCY_VALID': 'Use valid currencies: AED, SAR, MYR, or USD',
      'TRN_PRESENT': 'Ensure both buyer and seller TRN fields are populated'
    };

    return suggestions[ruleId] || 'Review data for compliance';
  }
}

module.exports = RulesValidator;