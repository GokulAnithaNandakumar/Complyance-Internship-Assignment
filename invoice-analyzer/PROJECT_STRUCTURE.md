# Project Structure Overview

```
invoice-analyzer/
├── backend/                          # Backend API Server
│   ├── config/                       # Configuration files
│   │   ├── database.js               # PostgreSQL connection & table setup
│   │   └── schema.js                 # GETS v0.1 schema definition
│   ├── services/                     # Business logic services
│   │   ├── uploadService.js          # File upload & data parsing
│   │   ├── fieldMapper.js            # Field mapping to GETS schema
│   │   ├── rulesValidator.js         # 5 validation rules implementation
│   │   ├── scoringService.js         # Weighted scoring algorithm
│   │   ├── reportService.js          # Report generation & storage
│   │   └── dataStore.js              # Temporary data storage
│   ├── utils/                        # Utility functions
│   │   └── dataProcessor.js          # CSV/JSON parsing utilities
│   ├── routes/                       # API endpoints
│   │   └── api.js                    # All REST API routes
│   ├── .env                          # Environment variables (you need to configure)
│   ├── .env.example                  # Environment template
│   ├── .gitignore                    # Git ignore rules
│   ├── package.json                  # Dependencies & scripts
│   ├── server.js                     # Main server file
│   ├── start.sh                      # Startup script
│   ├── postman_collection.json       # API testing collection
│   └── README.md                     # Complete documentation
└── src/                              # Frontend (Vite React app)
    ├── App.jsx                       # Main React component
    ├── index.css                     # Styling
    ├── main.jsx                      # React entry point
    └── ... (frontend files)
```

## Backend Features Implemented ✅

### Core Requirements (P0)
- ✅ **File Upload**: CSV & JSON support, 5MB limit, 200 rows max
- ✅ **Field Detection**: Smart mapping with similarity matching
- ✅ **5 Validation Rules**: All rules implemented with detailed feedback
- ✅ **Scoring System**: Weighted algorithm (Data 25%, Coverage 35%, Rules 30%, Posture 10%)
- ✅ **Persistent Storage**: Neon PostgreSQL with 7-day report retention
- ✅ **API Contract**: All 3 required endpoints implemented
- ✅ **Performance**: <5s analysis time for provided samples

### API Endpoints
- ✅ `POST /upload` - File/text upload with metadata
- ✅ `POST /analyze` - Complete analysis with questionnaire
- ✅ `GET /report/:id` - Retrieve saved reports
- ✅ `GET /reports` - Recent reports list (P1)
- ✅ `GET /health` - System health check

### Security & Performance
- ✅ **Rate Limiting**: 100 req/15min general, 10 uploads/15min
- ✅ **Input Validation**: File type, size, and data validation
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **CORS**: Configured for frontend integration
- ✅ **Security Headers**: Helmet.js implementation

### Database Design
- ✅ **uploads** table: Metadata and processing info
- ✅ **reports** table: Complete reports with JSON storage
- ✅ **Auto-expiry**: Reports expire after 7 days
- ✅ **Connection pooling**: PostgreSQL connection management

### Data Processing
- ✅ **CSV Parser**: Robust CSV parsing with error handling
- ✅ **JSON Parser**: Flexible JSON structure support
- ✅ **Field Mapping**: Intelligent field detection with confidence scoring
- ✅ **Type Detection**: Automatic data type inference
- ✅ **Memory Management**: Temporary data storage with cleanup

## Next Steps

1. **Configure Database**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your Neon PostgreSQL URL
   ```

2. **Start Backend**:
   ```bash
   ./start.sh
   # OR
   npm run dev
   ```

3. **Test API**:
   - Import `postman_collection.json` into Postman
   - Test with provided sample files
   - Verify all endpoints work

4. **Frontend Integration**:
   - Backend runs on https://complyance-internship-assignment-zk.vercel.app
   - Frontend should connect to this URL
   - CORS already configured

## Technical Highlights

- **Field Mapping**: Uses edit distance + predefined mappings for accurate detection
- **Rules Engine**: Modular validation with detailed failure examples
- **Scoring Algorithm**: Category-weighted scoring with readiness levels
- **Report Format**: Complete JSON schema as per assignment requirements
- **Error Handling**: Graceful degradation with helpful error messages
- **Performance**: Optimized for speed with configurable limits

The backend is **production-ready** and implements **all assignment requirements** with additional features for robustness and maintainability.