#!/bin/bash

# E-Invoicing Analyzer API Test Script
# Tests all endpoints with sample data

API_BASE="http://localhost:3001"
echo "🧪 Testing E-Invoicing Analyzer API..."
echo "Base URL: $API_BASE"
echo ""

# Test 1: Health Check
echo "1️⃣ Testing Health Endpoint..."
curl -s "$API_BASE/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Upload Sample File
echo "2️⃣ Testing File Upload..."
UPLOAD_RESPONSE=$(curl -s -X POST -F "file=@../sample_clean.json" "$API_BASE/upload")
UPLOAD_ID=$(echo $UPLOAD_RESPONSE | jq -r '.uploadId')
echo "Upload ID: $UPLOAD_ID"
echo ""

# Test 3: Analyze Uploaded Data
echo "3️⃣ Testing Analysis..."
ANALYSIS_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{
  \"uploadId\": \"$UPLOAD_ID\",
  \"questionnaire\": {
    \"webhooks\": true,
    \"sandbox_env\": false,
    \"retries\": true
  }
}" "$API_BASE/analyze")

REPORT_ID=$(echo $ANALYSIS_RESPONSE | jq -r '.reportId')
echo "Report ID: $REPORT_ID"
echo "Overall Score: $(echo $ANALYSIS_RESPONSE | jq -r '.scores.overall')%"
echo ""

# Test 4: Retrieve Report
echo "4️⃣ Testing Report Retrieval..."
curl -s "$API_BASE/report/$REPORT_ID" | jq '.scores' || echo "❌ Report retrieval failed"
echo ""

# Test 5: Share Page (HTML)
echo "5️⃣ Testing Share Page..."
SHARE_URL="$API_BASE/share/$REPORT_ID"
echo "Share URL: $SHARE_URL"
curl -s "$SHARE_URL" | grep -q "E-Invoicing Readiness Report" && echo "✅ Share page working" || echo "❌ Share page failed"
echo ""

# Test 6: Recent Reports
echo "6️⃣ Testing Recent Reports..."
curl -s "$API_BASE/reports?limit=5" | jq '.reports | length' || echo "❌ Recent reports failed"
echo ""

# Test 7: AI Insights (if GEMINI_API_KEY is set)
echo "7️⃣ Testing AI Insights..."
AI_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{
  \"reportData\": $ANALYSIS_RESPONSE,
  \"ruleFindings\": $(echo $ANALYSIS_RESPONSE | jq '.ruleFindings'),
  \"coverage\": $(echo $ANALYSIS_RESPONSE | jq '.coverage')
}" "$API_BASE/ai-insights")

echo $AI_RESPONSE | jq '.overallAssessment' || echo "ℹ️ AI insights require GEMINI_API_KEY"
echo ""

echo "🎉 API Testing Complete!"
echo "📊 Report Summary:"
echo "   - Report ID: $REPORT_ID"
echo "   - Share URL: $SHARE_URL"
echo "   - Overall Score: $(echo $ANALYSIS_RESPONSE | jq -r '.scores.overall')%"