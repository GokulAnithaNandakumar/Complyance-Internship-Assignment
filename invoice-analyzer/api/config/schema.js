// GETS v0.1 Schema Definition
const GETS_SCHEMA = {
  version: "0.1",
  fields: [
    // Invoice Header Fields
    { path: "invoice.id", type: "string", required: true, category: "header" },
    { path: "invoice.issue_date", type: "date", format: "YYYY-MM-DD", required: true, category: "header" },
    { path: "invoice.currency", type: "enum", enum: ["AED", "SAR", "MYR", "USD"], required: true, category: "header" },
    { path: "invoice.total_excl_vat", type: "number", required: true, category: "header" },
    { path: "invoice.vat_amount", type: "number", required: true, category: "header" },
    { path: "invoice.total_incl_vat", type: "number", required: true, category: "header" },
    
    // Seller Fields
    { path: "seller.name", type: "string", required: true, category: "seller" },
    { path: "seller.trn", type: "string", required: true, category: "seller" },
    { path: "seller.country", type: "string", pattern: "^[A-Z]{2}$", required: true, category: "seller" },
    { path: "seller.city", type: "string", required: false, category: "seller" },
    
    // Buyer Fields
    { path: "buyer.name", type: "string", required: true, category: "buyer" },
    { path: "buyer.trn", type: "string", required: true, category: "buyer" },
    { path: "buyer.country", type: "string", pattern: "^[A-Z]{2}$", required: true, category: "buyer" },
    { path: "buyer.city", type: "string", required: false, category: "buyer" },
    
    // Line Items Fields
    { path: "lines[].sku", type: "string", required: true, category: "lines" },
    { path: "lines[].description", type: "string", required: false, category: "lines" },
    { path: "lines[].qty", type: "number", required: true, category: "lines" },
    { path: "lines[].unit_price", type: "number", required: true, category: "lines" },
    { path: "lines[].line_total", type: "number", required: true, category: "lines" }
  ]
};

// Field mapping configurations for common variations
const FIELD_MAPPINGS = {
  // Invoice ID variations
  "invoice.id": ["inv_id", "invoice_id", "inv_no", "invoice_number", "id", "invoiceId"],
  
  // Date variations
  "invoice.issue_date": ["date", "issue_date", "issued_on", "invoice_date", "issueDate"],
  
  // Currency variations
  "invoice.currency": ["currency", "curr", "ccy"],
  
  // Amount variations
  "invoice.total_excl_vat": ["total_excl_vat", "totalNet", "net_amount", "subtotal"],
  "invoice.vat_amount": ["vat_amount", "vat", "tax_amount", "tax"],
  "invoice.total_incl_vat": ["total_incl_vat", "grandTotal", "total_amount", "total"],
  
  // Seller variations
  "seller.name": ["seller_name", "sellerName", "vendor_name", "supplier_name"],
  "seller.trn": ["seller_trn", "sellerTax", "seller_tax", "vendor_trn"],
  "seller.country": ["seller_country", "sellerCountry", "vendor_country"],
  "seller.city": ["seller_city", "sellerCity", "vendor_city"],
  
  // Buyer variations
  "buyer.name": ["buyer_name", "buyerName", "customer_name", "client_name"],
  "buyer.trn": ["buyer_trn", "buyerTax", "buyer_tax", "customer_trn"],
  "buyer.country": ["buyer_country", "buyerCountry", "customer_country"],
  "buyer.city": ["buyer_city", "buyerCity", "customer_city"],
  
  // Line item variations
  "lines[].sku": ["sku", "lineSku", "item_code", "product_code"],
  "lines[].description": ["description", "lineDesc", "item_description", "product_name"],
  "lines[].qty": ["qty", "lineQty", "quantity", "amount"],
  "lines[].unit_price": ["unit_price", "linePrice", "price", "rate"],
  "lines[].line_total": ["line_total", "lineTotal", "amount", "total"]
};

// Scoring weights
const SCORING_WEIGHTS = {
  data: 0.25,      // 25% - Data parsing success
  coverage: 0.35,  // 35% - Field coverage
  rules: 0.30,     // 30% - Rule compliance
  posture: 0.10    // 10% - Readiness posture
};

// Category weights for coverage scoring
const CATEGORY_WEIGHTS = {
  header: 0.4,   // 40% weight for header fields
  seller: 0.25,  // 25% weight for seller fields
  buyer: 0.25,   // 25% weight for buyer fields
  lines: 0.1     // 10% weight for line fields
};

module.exports = {
  GETS_SCHEMA,
  FIELD_MAPPINGS,
  SCORING_WEIGHTS,
  CATEGORY_WEIGHTS
};