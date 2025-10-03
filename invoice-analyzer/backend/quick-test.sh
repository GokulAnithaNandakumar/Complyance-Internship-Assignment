#!/bin/bash

echo "🧪 Quick Backend Test"
echo "====================="

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s http://localhost:3001/health | head -n 5
echo ""

# Test with sample data if backend is running
echo "2. Testing sample upload..."
if [ -f "../sample_clean.json" ]; then
    echo "Found sample_clean.json, testing upload..."
    UPLOAD_ID=$(curl -s -X POST -F "file=@../sample_clean.json" "http://localhost:3001/upload" | jq -r '.uploadId')
    echo "Upload ID: $UPLOAD_ID"

    if [ "$UPLOAD_ID" != "null" ] && [ "$UPLOAD_ID" != "" ]; then
        echo "3. Testing analysis..."
        ANALYSIS=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"uploadId\":\"$UPLOAD_ID\",\"questionnaire\":{\"webhooks\":true,\"sandbox_env\":false,\"retries\":true}}" "http://localhost:3001/analyze")
        REPORT_ID=$(echo $ANALYSIS | jq -r '.reportId')
        echo "Report ID: $REPORT_ID"

        if [ "$REPORT_ID" != "null" ] && [ "$REPORT_ID" != "" ]; then
            echo "4. Testing share page..."
            SHARE_URL="http://localhost:3001/share/$REPORT_ID"
            echo "Share URL: $SHARE_URL"

            # Test if share page returns HTML
            curl -s "$SHARE_URL" | grep -q "E-Invoicing Readiness Report" && echo "✅ Share page works!" || echo "❌ Share page failed"

            echo "5. Testing report JSON..."
            curl -s "http://localhost:3001/report/$REPORT_ID" | jq '.scores.overall' && echo "✅ Report JSON works!" || echo "❌ Report JSON failed"
        else
            echo "❌ Analysis failed"
        fi
    else
        echo "❌ Upload failed"
    fi
else
    echo "❌ sample_clean.json not found"
fi

echo ""
echo "🎯 Frontend should now work at: http://localhost:5173"
echo "📄 Sample share page: http://localhost:3001/share/[reportId]"