# E-Invoicing Readiness & Gap Analyzer

A comprehensive web application that analyzes invoice data for GETS (Government Electronic Trading Services) compliance, providing detailed scoring, validation results, and AI-powered recommendations.

## ✨ Key Features

### Core Functionality
- **3-Step Wizard Interface**: Context → Upload → Results
- **Multi-format Support**: CSV and JSON file processing (up to 200 rows)
- **Real-time Analysis**: Complete validation in under 5 seconds
- **Persistent Reports**: All reports saved to database with 7-day retention

### Advanced Analysis
- **5 Critical Rule Validations**:
  - `TOTALS_BALANCE`: Validates invoice total calculations
  - `LINE_MATH`: Checks line item mathematics
  - `DATE_ISO`: Ensures ISO date format compliance
  - `CURRENCY_ALLOWED`: Validates currency codes (AED, SAR, MYR, USD)
  - `TRN_PRESENT`: Verifies tax registration numbers

- **Field Coverage Analysis**: Automatic mapping to GETS v0.1 schema (25+ fields)
- **4-Dimension Scoring**: Data Quality, Coverage, Rules Compliance, Technical Posture
- **Detailed Error Reporting**: Specific line numbers, values, and fix instructions

### AI-Powered Insights
- **Smart Recommendations**: Gemini AI analyzes failures and suggests improvements
- **Priority Issue Detection**: AI identifies critical problems to fix first
- **Field Mapping Suggestions**: Intelligent suggestions for close field matches
- **Actionable Next Steps**: Prioritized improvement roadmap

### Sharing & Export
- **JSON Report Export**: Complete analysis results for integration
- **Shareable Links**: Public report URLs with expiration (7 days)
- **HTML Share Pages**: Clean, professional report viewing
- **Copy-to-Clipboard**: Easy sharing with team members

### User Experience
- **Material-UI Design**: Modern, responsive interface
- **Dark/Light Themes**: User preference themes
- **Real-time Validation**: Instant feedback on file uploads
- **Error Boundaries**: Graceful error handling
- **Recent Reports**: Quick access to previous analyses

## 🚀 Quick Start

### Frontend
```bash
npm install
npm run dev
# Opens on https://complyance-internship-assignment.vercel.app
```

### Backend
```bash
cd backend
npm install
npm start
# Runs on https://complyance-internship-assignment-zk.vercel.app
```

## 🛠 Technology Stack

- **Frontend**: React 18 + Vite + Material-UI v5
- **Backend**: Node.js + Express + PostgreSQL
- **AI Integration**: Google Gemini Pro API
- **Database**: PostgreSQL with connection pooling
- **File Processing**: CSV/JSON parsing with validation

## 📊 Scoring Algorithm

**Overall Score = Data(25%) + Coverage(35%) + Rules(30%) + Posture(10%)**

- **Data Quality (25%)**: Successful parsing rate and type inference
- **Coverage (35%)**: GETS field mapping completeness
- **Rules Compliance (30%)**: Business rule validation results
- **Technical Posture (10%)**: Integration readiness from questionnaire

**Readiness Levels**:
- 🟢 **High (80-100%)**: Production ready
- 🟡 **Medium (60-79%)**: Minor improvements needed
- 🔴 **Low (0-59%)**: Significant work required

## 🔧 Configuration

### Environment Variables
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@host/db
PORT=3001
GEMINI_API_KEY=your_api_key_here  # Optional for AI features
MAX_FILE_SIZE=5242880
REPORT_EXPIRY_DAYS=7
```

### API Endpoints
- `POST /upload` - File upload and initial processing
- `POST /analyze` - Run complete analysis with questionnaire
- `GET /report/:id` - Retrieve saved report JSON
- `GET /share/:id` - Public HTML report view
- `POST /ai-insights` - Generate AI recommendations
- `GET /reports` - List recent reports
- `GET /health` - System health check

## 📈 Usage Examples

### 1. File Upload & Analysis
```javascript
// Upload file
const uploadResponse = await fetch('/upload', {
  method: 'POST',
  body: formData
});

// Analyze with questionnaire
const analysis = await fetch('/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uploadId: uploadResponse.uploadId,
    questionnaire: { webhooks: true, sandbox_env: false, retries: true }
  })
});
```

### 2. Share Report
```javascript
// Get shareable link
const shareUrl = `${API_BASE_URL}/share/${reportId}`;
await navigator.clipboard.writeText(shareUrl);
```

## 🧪 Sample Data

The project includes test files:
- `sample_clean.json` - Should pass most validations
- `sample_flawed.csv` - Contains intentional errors for testing

## 🎯 Validation Rules Details

| Rule | Description | Error Examples |
|------|-------------|----------------|
| **TOTALS_BALANCE** | `total_excl_vat + vat_amount = total_incl_vat` | 100 + 15 ≠ 110 |
| **LINE_MATH** | `qty × unit_price = line_total` | 3 × 25.50 ≠ 76.00 |
| **DATE_ISO** | Dates in YYYY-MM-DD format | "31/01/2025" instead of "2025-01-31" |
| **CURRENCY_ALLOWED** | Currency in [AED, SAR, MYR, USD] | "EUR" or "EURO" not allowed |
| **TRN_PRESENT** | Both buyer.trn and seller.trn exist | Missing tax registration numbers |

## 🤖 AI Features Setup

1. Get Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to backend `.env`: `GEMINI_API_KEY=your_key_here`
3. AI insights will automatically enhance validation results

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔒 Security Features

- File type validation
- Size limits (5MB default)
- SQL injection prevention
- Rate limiting ready
- Error sanitization

---

**Built for the Complyance Internship Assignment** - A production-ready tool for e-invoicing compliance analysis.
