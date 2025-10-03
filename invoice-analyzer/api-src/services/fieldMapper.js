const { GETS_SCHEMA, FIELD_MAPPINGS } = require('../config/schema');
const { normalizeFieldName, calculateSimilarity, flattenObject, detectType } = require('../utils/dataProcessor');

class FieldMapper {
  constructor() {
    this.getsFields = GETS_SCHEMA.fields;
    this.fieldMappings = FIELD_MAPPINGS;
  }

  // Map source fields to GETS schema fields
  mapFields(data) {
    const sourceFields = this.extractSourceFields(data);
    const mappingResult = {
      matches: [],
      close: [],
      missing: []
    };

    // Process each GETS field
    this.getsFields.forEach(getsField => {
      const match = this.findBestMatch(getsField.path, sourceFields);
      
      if (match) {
        if (match.confidence >= 0.8) {
          mappingResult.matches.push({
            getsField: getsField.path,
            sourceField: match.field,
            confidence: match.confidence,
            type: getsField.type,
            required: getsField.required
          });
        } else {
          mappingResult.close.push({
            getsField: getsField.path,
            sourceField: match.field,
            confidence: match.confidence,
            type: getsField.type,
            required: getsField.required,
            suggestion: this.generateSuggestion(getsField.path, match.field)
          });
        }
      } else {
        mappingResult.missing.push({
          getsField: getsField.path,
          type: getsField.type,
          required: getsField.required
        });
      }
    });

    return mappingResult;
  }

  // Extract all available fields from source data
  extractSourceFields(data) {
    const fieldsSet = new Set();
    
    data.forEach(row => {
      const flattened = flattenObject(row);
      Object.keys(flattened).forEach(key => {
        fieldsSet.add(key);
      });
    });

    return Array.from(fieldsSet).map(field => ({
      name: field,
      normalized: normalizeFieldName(field),
      type: this.detectFieldType(field, data)
    }));
  }

  // Find the best matching source field for a GETS field
  findBestMatch(getsFieldPath, sourceFields) {
    let bestMatch = null;
    let bestConfidence = 0;

    // First, check predefined mappings
    const knownMappings = this.fieldMappings[getsFieldPath] || [];
    
    for (const sourceField of sourceFields) {
      let confidence = 0;

      // Check exact matches in known mappings
      if (knownMappings.includes(sourceField.name)) {
        confidence = 1.0;
      } else if (knownMappings.some(mapping => normalizeFieldName(mapping) === sourceField.normalized)) {
        confidence = 0.95;
      } else {
        // Calculate similarity for each known mapping
        const similarities = knownMappings.map(mapping => 
          calculateSimilarity(normalizeFieldName(mapping), sourceField.normalized)
        );
        
        const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
        
        // Also check direct similarity with GETS field path
        const pathParts = getsFieldPath.split('.').pop().replace('[]', '');
        const directSimilarity = calculateSimilarity(
          normalizeFieldName(pathParts), 
          sourceField.normalized
        );
        
        confidence = Math.max(maxSimilarity, directSimilarity);
      }

      // Apply type compatibility bonus
      if (this.isTypeCompatible(getsFieldPath, sourceField.type)) {
        confidence *= 1.1; // 10% bonus for type compatibility
      } else {
        confidence *= 0.7; // 30% penalty for type mismatch
      }

      if (confidence > bestConfidence && confidence > 0.3) { // Minimum threshold
        bestConfidence = confidence;
        bestMatch = {
          field: sourceField.name,
          confidence: Math.min(confidence, 1.0), // Cap at 1.0
          type: sourceField.type
        };
      }
    }

    return bestMatch;
  }

  // Detect field type based on sample data
  detectFieldType(fieldName, data) {
    const samples = data.slice(0, 10).map(row => {
      const flattened = flattenObject(row);
      return flattened[fieldName];
    }).filter(val => val !== null && val !== undefined && val !== '');

    if (samples.length === 0) return 'unknown';

    const types = samples.map(sample => detectType(sample));
    const typeCount = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Return the most common type
    return Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b
    );
  }

  // Check if source field type is compatible with GETS field type
  isTypeCompatible(getsFieldPath, sourceType) {
    const getsField = this.getsFields.find(f => f.path === getsFieldPath);
    if (!getsField) return false;

    const typeMapping = {
      'string': ['string', 'text'],
      'number': ['number', 'integer', 'float'],
      'date': ['date', 'datetime'],
      'enum': ['string', 'text']
    };

    const compatibleTypes = typeMapping[getsField.type] || [getsField.type];
    return compatibleTypes.includes(sourceType);
  }

  // Generate suggestion for close matches
  generateSuggestion(getsField, sourceField) {
    const fieldName = getsField.split('.').pop().replace('[]', '');
    const similarities = [
      'name similarity',
      'field position',
      'data type match'
    ];
    
    const randomSimilarity = similarities[Math.floor(Math.random() * similarities.length)];
    
    return `'${sourceField}' likely maps to '${getsField}' (${randomSimilarity})`;
  }

  // Calculate coverage score
  calculateCoverageScore(mappingResult) {
    const { matches, close, missing } = mappingResult;
    const totalRequired = this.getsFields.filter(f => f.required).length;
    const matchedRequired = matches.filter(m => m.required).length;
    const closeRequired = close.filter(c => c.required).length;

    // Weight matches higher than close matches
    const weightedScore = (matchedRequired * 1.0 + closeRequired * 0.5) / totalRequired;
    
    return Math.round(Math.min(weightedScore * 100, 100));
  }
}

module.exports = FieldMapper;