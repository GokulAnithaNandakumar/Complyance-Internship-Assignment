const csv = require('csv-parser');
const { Readable } = require('stream');

// Normalize field names for comparison
const normalizeFieldName = (name) => {
  return name.toLowerCase()
    .replace(/[_\s-]/g, '')
    .trim();
};

// Calculate string similarity using simple edit distance
const calculateSimilarity = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - (matrix[len1][len2] / maxLen);
};

// Parse CSV content
const parseCSV = (content) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const readable = Readable.from([content]);
    
    readable
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

// Parse JSON content
const parseJSON = (content) => {
  try {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
};

// Detect data type of a value
const detectType = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }
  
  const str = String(value).trim();
  
  // Check if it's a number
  if (!isNaN(str) && !isNaN(parseFloat(str))) {
    return 'number';
  }
  
  // Check if it's a date (YYYY-MM-DD format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return 'date';
    }
  }
  
  // Check if it's a date (other formats)
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)) {
    return 'date';
  }
  
  return 'string';
};

// Flatten nested objects for field detection
const flattenObject = (obj, prefix = '') => {
  const flattened = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else if (Array.isArray(obj[key])) {
        // Handle arrays (like lines)
        flattened[`${newKey}[]`] = obj[key];
        
        // Also flatten first array item for field detection
        if (obj[key].length > 0 && typeof obj[key][0] === 'object') {
          Object.assign(flattened, flattenObject(obj[key][0], `${newKey}[]`));
        }
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }
  
  return flattened;
};

// Process data and limit to max rows
const processData = (data, maxRows = 200) => {
  const limitedData = data.slice(0, maxRows);
  const totalRows = data.length;
  const processedRows = limitedData.length;
  
  return {
    data: limitedData,
    totalRows,
    processedRows,
    truncated: totalRows > maxRows
  };
};

module.exports = {
  normalizeFieldName,
  calculateSimilarity,
  parseCSV,
  parseJSON,
  detectType,
  flattenObject,
  processData
};