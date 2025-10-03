# E-Invoicing Readiness Analyzer - Backend

A comprehensive backend API for analyzing invoice data against the GETS v0.1 schema. This service provides field mapping, validation rules, scoring, and persistent report storage.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Neon PostgreSQL database
- npm or yarn

### Installation

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Configuration**
Copy your Neon PostgreSQL connection URL to `.env`:
```bash
# Update the DATABASE_URL with your Neon PostgreSQL URL
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
```

3. **Start Development Server**
```bash
npm run dev
```

The API will be available at `https://complyance-internship-assignment-backend.onrender.com`

## 🏗️ Architecture

### Database Schema
- **uploads**: Stores upload metadata and processing info
- **reports**: Stores complete analysis reports with expiry dates

### Services
- **UploadService**: Handles file/text data processing
- **FieldMapper**: Maps source fields to GETS schema
- **RulesValidator**: Implements 5 validation rules
- **ScoringService**: Calculates weighted scores (0-100)
- **ReportService**: Generates and persists reports

## 📡 API Endpoints

### POST /upload
Upload invoice data (CSV or JSON)

**Multipart Form:**
```bash
curl -X POST https://complyance-internship-assignment-backend.onrender.com/upload \
  -F "file=@sample_clean.json" \
  -F "country=AE" \
  -F "erp=SAP"
```

**JSON Payload:**
```bash
curl -X POST https://complyance-internship-assignment-backend.onrender.com/upload \
  -H "Content-Type: application/json" \
  -d '{
    "text": "csv or json string here...",
    "country": "AE",
    "erp": "SAP"
  }'
```

**Response:**
```json
{
  "uploadId": "u_abc123456789",
  "metadata": {
    "fileType": "json",
    "totalRows": 2,
    "processedRows": 2,
    "truncated": false
  }
}
```

### POST /analyze
Analyze uploaded data and generate report

**Request:**
```bash
curl -X POST https://complyance-internship-assignment-backend.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "u_abc123456789",
    "questionnaire": {
      "webhooks": true,
      "sandbox_env": true,
      "retries": false
    }
  }'
```

**Response:** Complete report JSON (see Report Schema below)

### GET /report/:reportId
Retrieve saved report

**Request:**
```bash
curl https://complyance-internship-assignment-backend.onrender.com/report/r_def456789012
```

**Response:** Same as analyze endpoint

### GET /reports?limit=10
Get recent reports list

**Response:**
```json
{
  "reports": [
    {
      "reportId": "r_def456789012",
      "createdAt": "2025-01-15T10:30:00Z",
      "overallScore": 85,
      "country": "AE",
      "erp": "SAP",
      "rowsAnalyzed": 2
    }
  ],
  "count": 1,
  "limit": 10
}
```

### GET /health
System health check

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "upload": "operational",
    "analysis": "operational"
  },
  "stats": {
    "total_uploads": "150",
    "uploads_last_24h": "12",
    "avg_rows_parsed": "45.5"
  },
  "version": "1.0.0",
  "environment": "development"
}
```

## 📊 Report Schema

The complete report structure includes:

```json
{
  "reportId": "r_123",
  "uploadId": "u_456",
  "meta": {
    "version": "1.0",
    "generated_at": "2025-01-15T10:30:00Z",
    "expires_at": "2025-01-22T10:30:00Z",
    "db": "postgres",
    "rows_analyzed": 2,
    "total_rows": 2,
    "truncated": false
  },
  "scores": {
    "overall": 85,
    "breakdown": {
      "data": 95,
      "coverage": 80,
      "rules": 90,
      "posture": 65
    },
    "readiness": {
      "level": "High",
      "description": "Ready for e-invoicing implementation",
      "color": "green"
    },
    "weights": {
      "data": "25%",
      "coverage": "35%",
      "rules": "30%",
      "posture": "10%"
    }
  },
  "coverage": {
    "summary": {
      "total_fields": 19,
      "matched": 15,
      "close": 2,
      "missing": 2
    },
    "matches": [...],
    "close": [...],
    "missing": [...]
  },
  "rules": {
    "summary": {
      "total_rules": 5,
      "passed": 4,
      "failed": 1,
      "score": 80
    },
    "results": [...]
  },
  "questionnaire": {
    "responses": {...},
    "score": 65
  },
  "recommendations": [...]
}
```

## 🔍 Validation Rules

### 1. TOTALS_BALANCE
Verifies: `total_excl_vat + vat_amount = total_incl_vat` (±0.01 tolerance)

### 2. LINE_MATH
Verifies: `line_total = qty × unit_price` (±0.01 tolerance)

### 3. DATE_ISO
Verifies: Invoice dates are in `YYYY-MM-DD` format

### 4. CURRENCY_VALID
Verifies: Currency is one of `AED`, `SAR`, `MYR`, `USD`

### 5. TRN_PRESENT
Verifies: Both buyer and seller TRN fields are non-empty

## 📈 Scoring Algorithm

**Overall Score = Data(25%) + Coverage(35%) + Rules(30%) + Posture(10%)**

- **Data Score**: Parsing success rate + data quality
- **Coverage Score**: Weighted by field categories (Header: 40%, Seller/Buyer: 25% each, Lines: 10%)
- **Rules Score**: Equal weight across 5 validation rules
- **Posture Score**: Questionnaire responses (webhooks: 40pts, sandbox: 35pts, retries: 25pts)

**Readiness Levels:**
- **High** (80-100): Ready for implementation
- **Medium** (60-79): Some improvements needed
- **Low** (0-59): Significant improvements required

## 🗃️ Database Configuration

The system uses **Neon PostgreSQL** with these tables:

```sql
-- Uploads table
CREATE TABLE uploads (
  id VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  country VARCHAR(10),
  erp VARCHAR(100),
  rows_parsed INTEGER,
  pii_masked BOOLEAN DEFAULT false,
  file_type VARCHAR(10),
  original_filename VARCHAR(255)
);

-- Reports table
CREATE TABLE reports (
  id VARCHAR(255) PRIMARY KEY,
  upload_id VARCHAR(255) REFERENCES uploads(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scores_overall INTEGER,
  report_json JSONB,
  expires_at TIMESTAMP
);
```

## 🔧 Configuration

Key environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# Server
PORT=3001
NODE_ENV=development

# File Processing
MAX_FILE_SIZE=5242880  # 5MB
MAX_ROWS_TO_PROCESS=200

# CORS
FRONTEND_URL=https://complyance-internship-assignment.vercel.app

# Report Storage
REPORT_EXPIRY_DAYS=7
```

## 🧪 Testing

Test with the provided sample files:

```bash
# Test clean data (should mostly pass)
curl -X POST https://complyance-internship-assignment-backend.onrender.com/upload \
  -F "file=@../sample_clean.json"

# Test flawed data (should fail some rules)
curl -X POST https://complyance-internship-assignment-backend.onrender.com/upload \
  -F "file=@../sample_flawed.csv"
```

## 🚦 Performance

- **File Size Limit**: 5MB default
- **Row Processing**: Limited to 200 rows
- **Analysis Time**: <5 seconds for provided samples
- **Rate Limiting**: 100 requests/15min, 10 uploads/15min per IP

## 🔒 Security Features

- Helmet.js security headers
- Rate limiting
- Input validation
- File type restrictions
- SQL injection protection via parameterized queries
- CORS configuration

## 📋 Error Handling

Standard error response format:
```json
{
  "error": "Error message",
  "message": "Detailed description",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Check dependencies
npm list

# Update dependencies
npm update
```

## 🏷️ API Version

Current Version: **1.0.0**

The API implements the complete assignment requirements including:
- ✅ File upload (CSV/JSON)
- ✅ Field mapping with similarity detection
- ✅ 5 validation rules implementation
- ✅ Weighted scoring algorithm
- ✅ Persistent report storage (Neon PostgreSQL)
- ✅ Complete REST API endpoints
- ✅ Health monitoring
- ✅ Security and rate limiting