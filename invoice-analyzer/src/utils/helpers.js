// Utility functions for data processing and formatting

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getReadinessLevel = (score) => {
  if (score >= 80) return { label: 'High', color: 'success', description: 'Ready for implementation' };
  if (score >= 60) return { label: 'Medium', color: 'warning', description: 'Some improvements needed' };
  return { label: 'Low', color: 'error', description: 'Significant work required' };
};

export const getDataType = (value) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (!isNaN(value) && !isNaN(parseFloat(value))) return 'number';
  if (new Date(value).toString() !== 'Invalid Date' && value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
  return 'text';
};

export const getTypeColor = (value) => {
  const type = getDataType(value);
  switch (type) {
    case 'number': return 'success';
    case 'date': return 'info';
    case 'empty': return 'error';
    default: return 'default';
  }
};

export const downloadFile = (data, filename, type = 'application/json') => {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

export const validateFile = (file, maxSizeMB = 5) => {
  const allowedTypes = ['text/csv', 'application/json', 'text/plain'];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  const isValidType = allowedTypes.includes(file.type) ||
                     file.name.endsWith('.csv') ||
                     file.name.endsWith('.json');

  if (!isValidType) {
    return { valid: false, error: 'Invalid file type. Only CSV and JSON files are allowed.' };
  }

  return { valid: true };
};

export const getRuleDisplayName = (rule) => {
  const names = {
    'TOTALS_BALANCE': 'Invoice Totals Balance',
    'LINE_MATH': 'Line Item Mathematics',
    'DATE_ISO': 'Date Format Validation',
    'CURRENCY_ALLOWED': 'Currency Validation',
    'TRN_PRESENT': 'Tax Registration Numbers'
  };
  return names[rule] || rule.replace(/_/g, ' ');
};

export const getRuleDescription = (rule, isPass, details = {}) => {
  const descriptions = {
    'TOTALS_BALANCE': {
      pass: 'Invoice totals are mathematically correct',
      fail: 'Total excluding VAT + VAT amount should equal total including VAT'
    },
    'LINE_MATH': {
      pass: 'All line item calculations are correct',
      fail: `Line item calculation error${details.exampleLine ? ` (line ${details.exampleLine})` : ''}`
    },
    'DATE_ISO': {
      pass: 'All dates are in correct ISO format (YYYY-MM-DD)',
      fail: 'Invoice dates must use ISO format (YYYY-MM-DD)'
    },
    'CURRENCY_ALLOWED': {
      pass: 'Currency is from the allowed list',
      fail: `Invalid currency${details.value ? ` "${details.value}"` : ''}. Use: AED, SAR, MYR, or USD`
    },
    'TRN_PRESENT': {
      pass: 'Both buyer and seller tax registration numbers are present',
      fail: 'Missing tax registration numbers for buyer or seller'
    }
  };

  const ruleDesc = descriptions[rule];
  if (!ruleDesc) return rule;

  return isPass ? ruleDesc.pass : ruleDesc.fail;
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};