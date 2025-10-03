import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    Alert,
    CircularProgress,
    LinearProgress,
    Chip,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Divider,
    IconButton,
    Collapse,
    Badge,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Snackbar
} from '@mui/material';
import {
    ArrowBack,
    Refresh,
    Download,
    Share,
    CheckCircle,
    Error,
    Warning,
    Info,
    ExpandMore,
    Assessment,
    DataObject,
    Rule,
    Security,
    ContentCopy,
    OpenInNew,
    Link,
    SmartToy
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = 'https://complyance-internship-assignment-zk.vercel.app';

const ScoreCard = ({ title, score, color, icon, description }) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {icon}
                <Typography variant="h6" sx={{ ml: 1 }}>
                    {title}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress
                        variant="determinate"
                        value={score}
                        sx={{
                            height: 10,
                            borderRadius: 5,
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: color,
                            },
                        }}
                    />
                </Box>
                <Typography variant="h6" color={color} fontWeight="bold">
                    {score}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
                {description}
            </Typography>
        </CardContent>
    </Card>
);

const CoveragePanel = ({ coverage }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Field Coverage Analysis</Typography>
                    <IconButton onClick={() => setExpanded(!expanded)}>
                        <ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </IconButton>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="success.main" fontWeight="bold">
                                {coverage?.summary?.matched || coverage?.matches?.length || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Matched
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="warning.main" fontWeight="bold">
                                {coverage?.summary?.close || coverage?.close?.length || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Close Match
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h4" color="error.main" fontWeight="bold">
                                {coverage?.summary?.missing || coverage?.missing?.length || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Missing
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                <Collapse in={expanded}>
                    <Divider sx={{ mb: 2 }} />

                    {coverage?.matches?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="success.main" gutterBottom>
                                ✓ Matched Fields
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {coverage.matches.map((field, index) => (
                                    <Chip
                                        key={index}
                                        label={`${field.source_field} → ${field.gets_field}`}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}

                    {coverage?.close?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                ⚠ Close Matches (Needs Review)
                            </Typography>
                            <List dense>
                                {coverage.close.map((item, index) => (
                                    <ListItem key={index} sx={{ py: 0.5 }}>
                                        <ListItemText
                                            primary={`${item.source_field} → ${item.gets_field}`}
                                            secondary={`Confidence: ${item.confidence}% - ${item.suggestion}`}
                                            primaryTypographyProps={{ variant: 'body2' }}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}

                    {coverage?.missing?.length > 0 && (
                        <Box>
                            <Typography variant="subtitle2" color="error.main" gutterBottom>
                                ✗ Missing Fields
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {coverage.missing.map((field, index) => (
                                    <Chip
                                        key={index}
                                        label={typeof field === 'string' ? field : field.gets_field || field.name || 'Unknown Field'}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Collapse>
            </CardContent>
        </Card>
    );
};

const RuleFindings = ({ ruleFindings }) => {
    // Normalize the data structure to handle both old and new formats
    const normalizedFindings = ruleFindings?.map(finding => {
        // If it's the new format (from rules.results)
        if ('passed' in finding) {
            return {
                ok: finding.passed,
                rule: finding.rule_id,
                name: finding.name,
                description: finding.description,
                details: finding.details,
                exampleLine: finding.example_line?.row,
                value: finding.example_line?.value,
                expected: finding.example_line?.validOptions,
                suggestion: finding.suggestion
            };
        }
        // If it's the old format, return as-is
        return finding;
    }) || [];

    const getIcon = (ok) => {
        return ok ? (
            <CheckCircle color="success" />
        ) : (
            <Error color="error" />
        );
    };

    const getRuleName = (rule) => {
        const names = {
            'TOTALS_BALANCE': 'Invoice Totals Balance',
            'LINE_MATH': 'Line Item Math',
            'DATE_ISO': 'Date Format (ISO)',
            'CURRENCY_ALLOWED': 'Currency Validation',
            'TRN_PRESENT': 'TRN Fields Present'
        };
        return names[rule] || rule;
    };

    const getRuleDescription = (rule, finding) => {
        const descriptions = {
            'TOTALS_BALANCE': 'Validates that total_excl_vat + vat_amount equals total_incl_vat (±0.01 tolerance)',
            'LINE_MATH': 'Verifies that for each line item: quantity × unit_price = line_total (±0.01 tolerance)',
            'DATE_ISO': 'Ensures all invoice dates follow the ISO format: YYYY-MM-DD (e.g., 2025-01-31)',
            'CURRENCY_ALLOWED': 'Confirms currency is one of the approved values: AED, SAR, MYR, or USD',
            'TRN_PRESENT': 'Checks that both buyer.trn and seller.trn fields contain valid tax registration numbers'
        };

        let desc = descriptions[rule] || rule;

        // Add specific error details
        if (!finding.ok) {
            if (finding.exampleLine) {
                desc += ` | ❌ Issue found at line ${finding.exampleLine}`;
            }
            if (finding.value) {
                desc += ` | ❌ Invalid value: "${finding.value}"`;
            }
            if (finding.expected && finding.got) {
                desc += ` | ❌ Expected: ${finding.expected}, Got: ${finding.got}`;
            }
        }

        return desc;
    };

    const getFixInstructions = (rule, finding) => {
        const instructions = {
            'TOTALS_BALANCE': {
                issue: 'Invoice totals don\'t balance properly',
                solution: 'Ensure your calculation follows: total_excl_vat + vat_amount = total_incl_vat',
                example: 'If total_excl_vat = 100.00 and vat_amount = 15.00, then total_incl_vat should be 115.00'
            },
            'LINE_MATH': {
                issue: `Line item calculation error${finding.exampleLine ? ` on line ${finding.exampleLine}` : ''}`,
                solution: 'Verify that quantity × unit_price = line_total for each line item',
                example: 'If qty = 3 and unit_price = 25.50, then line_total should be 76.50'
            },
            'DATE_ISO': {
                issue: 'Dates are not in the correct ISO format',
                solution: 'Convert all dates to YYYY-MM-DD format',
                example: 'Use "2025-01-31" instead of "31/01/2025" or "Jan 31, 2025"'
            },
            'CURRENCY_ALLOWED': {
                issue: `Invalid currency code${finding.value ? `: "${finding.value}"` : ''}`,
                solution: 'Use only approved currencies: AED, SAR, MYR, or USD',
                example: 'Change "EUR" or "EURO" to one of the approved codes like "USD"'
            },
            'TRN_PRESENT': {
                issue: 'Missing tax registration numbers',
                solution: 'Ensure both buyer.trn and seller.trn fields contain valid values',
                example: 'buyer.trn: "123456789001", seller.trn: "987654321001"'
            }
        };

        return instructions[rule] || {
            issue: 'Validation rule failed',
            solution: 'Please review and fix this validation error',
            example: 'Contact support for specific guidance'
        };
    };

    // Check if we have any rule findings to display
    if (!normalizedFindings || normalizedFindings.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Validation Results (No rules processed)
                    </Typography>
                    <Alert severity="info">
                        No validation rules were processed. This might indicate an issue with the analysis process.
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Validation Results ({normalizedFindings?.filter(r => r.ok).length || 0}/{normalizedFindings?.length || 0} Passing)
                </Typography>
                <List>
                    {normalizedFindings?.map((finding, index) => {
                        const fixInstructions = getFixInstructions(finding.rule, finding);
                        return (
                            <React.Fragment key={index}>
                                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                                        <ListItemIcon>
                                            {getIcon(finding.ok)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={getRuleName(finding.rule)}
                                            secondary={getRuleDescription(finding.rule, finding)}
                                            primaryTypographyProps={{
                                                color: finding.ok ? 'text.primary' : 'error.main',
                                                fontWeight: 'medium'
                                            }}
                                        />
                                        <Chip
                                            label={finding.ok ? 'PASS' : 'FAIL'}
                                            color={finding.ok ? 'success' : 'error'}
                                            size="small"
                                        />
                                    </Box>

                                    {!finding.ok && (
                                        <Box sx={{ ml: 7, mt: 1 }}>
                                            <Alert severity="error" sx={{ mb: 1 }}>
                                                <Typography variant="subtitle2" gutterBottom>
                                                    ❌ {fixInstructions.issue}
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Solution:</strong> {fixInstructions.solution}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                    <strong>Example:</strong> {fixInstructions.example}
                                                </Typography>
                                            </Alert>
                                        </Box>
                                    )}
                                </ListItem>
                                {index < ruleFindings.length - 1 && <Divider />}
                            </React.Fragment>
                        );
                    })}
                </List>

                {/* Summary */}
                {ruleFindings && ruleFindings.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            📊 Validation Summary
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {normalizedFindings.filter(r => r.ok).length} of {normalizedFindings.length} validation rules passed.
                            {normalizedFindings.filter(r => !r.ok).length > 0 && (
                                ` Fix the ${normalizedFindings.filter(r => !r.ok).length} failing rule${normalizedFindings.filter(r => !r.ok).length > 1 ? 's' : ''} above to improve your GETS compliance score.`
                            )}
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

const ResultsStep = ({ uploadData, contextData, reportData, setReportData, onReset }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [shareUrl, setShareUrl] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [aiInsights, setAiInsights] = useState(null);
    const [loadingInsights, setLoadingInsights] = useState(false);

    // Debug logging
    console.log('ResultsStep reportData:', reportData);
    console.log('ResultsStep scores:', reportData?.scores);
    console.log('ResultsStep coverage:', reportData?.coverage);
    console.log('ResultsStep reportData:', reportData);
    console.log('ResultsStep scores:', reportData?.scores);
    console.log('ResultsStep coverage:', reportData?.coverage);

    const analyzeData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_BASE_URL}/analyze`, {
                uploadId: uploadData.uploadId,
                questionnaire: contextData.questionnaire
            });

            setReportData(response.data);
            const newShareUrl = `${window.location.origin}/share/${response.data.reportId}`;
            console.log('Analysis complete, setting shareUrl:', newShareUrl, 'reportId:', response.data.reportId);
            setShareUrl(newShareUrl);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to analyze data');
        } finally {
            setLoading(false);
        }
    }, [uploadData, contextData, setReportData]);

    useEffect(() => {
        if (uploadData && !reportData) {
            analyzeData();
        } else if (reportData && reportData.reportId) {
            // Set share URL if reportData exists but shareUrl is empty
            if (!shareUrl) {
                const newShareUrl = `${window.location.origin}/share/${reportData.reportId}`;
                console.log('Setting shareUrl:', newShareUrl, 'origin:', window.location.origin, 'reportId:', reportData.reportId);
                setShareUrl(newShareUrl);
            }
        }
    }, [uploadData, reportData, analyzeData, shareUrl]);

    // Check if reportData already has AI insights and load them
    useEffect(() => {
        if (reportData?.aiInsights && !aiInsights) {
            console.log('Loading AI insights from reportData:', reportData.aiInsights);
            // Normalize the insights data
            const normalizedInsights = {
                ...reportData.aiInsights,
                nextSteps: reportData.aiInsights.nextSteps?.map(step => {
                    if (typeof step === 'string') {
                        return step;
                    } else if (step.action) {
                        return step.action;
                    } else if (step.step) {
                        return step.step;
                    } else if (step.description) {
                        return step.description;
                    } else {
                        return 'Improvement step';
                    }
                }) || []
            };
            setAiInsights(normalizedInsights);
        }
    }, [reportData, aiInsights]);

    const downloadReport = () => {
        if (!reportData) return;

        const dataStr = JSON.stringify(reportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `invoice-analysis-${reportData.reportId}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const downloadPdf = async () => {
        if (!reportData || !reportData.reportId) {
            setSnackbarMessage('Report not available for PDF export');
            setSnackbarOpen(true);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/share/${reportData.reportId}/pdf`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.download = `invoice-analysis-${reportData.reportId}.pdf`;
            linkElement.click();
            window.URL.revokeObjectURL(url);

            setSnackbarMessage('PDF downloaded successfully!');
            setSnackbarOpen(true);
        } catch (err) {
            console.error('PDF download error:', err);
            let errorMessage = 'Failed to download PDF';

            if (err.response?.status === 501) {
                errorMessage = 'PDF generation is not available in this environment. Please use JSON download instead.';
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            setSnackbarMessage(errorMessage);
            setSnackbarOpen(true);
        }
    };

    const copyShareUrl = async () => {
        if (!shareUrl) {
            setSnackbarMessage('Share link not available yet');
            setSnackbarOpen(true);
            return;
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            setSnackbarMessage('Share link copied to clipboard!');
            setSnackbarOpen(true);
        } catch (err) {
            setSnackbarMessage('Failed to copy link');
            setSnackbarOpen(true);
            console.log(err)
        }
    };

    const openHtmlShare = () => {
        if (!shareUrl) {
            setSnackbarMessage('Share view not available yet');
            setSnackbarOpen(true);
            return;
        }

        window.open(shareUrl, '_blank');
    };

    const getAiInsights = async () => {
        if (!reportData) return;

        setLoadingInsights(true);
        try {
            // Call our backend endpoint for AI insights
            const response = await axios.post(`${API_BASE_URL}/ai-insights`, {
                reportData: reportData,
                ruleFindings: reportData.rules?.results || reportData.ruleFindings || [],
                coverage: reportData.coverage
            });
            console.log('AI insights response:', response.data);
            // Normalize AI insights data to handle different formats
            const normalizedInsights = {
                ...response.data,
                nextSteps: response.data.nextSteps?.map(step => {
                    if (typeof step === 'string') {
                        return step;
                    } else if (step.action) {
                        return step.action;
                    } else if (step.step) {
                        return step.step;
                    } else if (step.description) {
                        return step.description;
                    } else {
                        return 'Improvement step';
                    }
                }) || []
            };

            setAiInsights(normalizedInsights);
        } catch (error) {
            console.error('Failed to get AI insights:', error);
            setSnackbarMessage('Failed to generate AI insights');
            setSnackbarOpen(true);
        } finally {
            setLoadingInsights(false);
        }
    };

    const getOverallReadinessLabel = (score) => {
        if (score >= 80) return { label: 'High', color: 'success.main' };
        if (score >= 60) return { label: 'Medium', color: 'warning.main' };
        return { label: 'Low', color: 'error.main' };
    };

    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    Analyzing your invoice data...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    This may take a few seconds
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
                <Button variant="outlined" onClick={analyzeData} startIcon={<Refresh />}>
                    Try Again
                </Button>
            </Box>
        );
    }

    if (!reportData) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>No analysis results available</Typography>
                <Button
                    variant="contained"
                    onClick={() => {
                        // Load the sample analysis data for testing
                        const sampleData = {
                            "reportId": "r_a4214a89a29f",
                            "uploadId": "u_abf848b5c5ca",
                            "scores": {
                                "overall": 57,
                                "breakdown": {
                                    "data": 100,
                                    "coverage": 75,
                                    "rules": 20,
                                    "posture": 0
                                }
                            },
                            "coverage": {
                                "summary": {
                                    "matched": 7,
                                    "close": 11,
                                    "missing": 1
                                },
                                "matches": [
                                    { "gets_field": "invoice.id", "source_field": "invoice_id", "confidence": 100 },
                                    { "gets_field": "invoice.issue_date", "source_field": "invoice_date", "confidence": 100 }
                                ],
                                "close": [
                                    { "gets_field": "invoice.total_excl_vat", "source_field": "tax_amount", "confidence": 73, "suggestion": "tax_amount likely maps to invoice.total_excl_vat" }
                                ],
                                "missing": [
                                    { "gets_field": "seller.country", "required": true, "type": "string" }
                                ]
                            }
                        };
                        setReportData(sampleData);
                    }}
                >
                    Load Sample Analysis Data
                </Button>
            </Box>
        );
    }

    const readiness = getOverallReadinessLabel(reportData.scores?.overall || 0);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom align="center" color="primary">
                Analysis Results
            </Typography>

            {/* Overall Score */}
            <Paper elevation={2} sx={{ p: 3, mb: 4, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
                <Typography variant="h3" fontWeight="bold">
                    {reportData.scores?.overall || 0}
                </Typography>
                <Typography variant="h5" sx={{ mb: 1 }}>
                    Overall Readiness Score
                </Typography>
                <Chip
                    label={readiness.label}
                    sx={{
                        bgcolor: readiness.color,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                    }}
                />
            </Paper>

            {/* Score Breakdown */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <ScoreCard
                        title="Data Quality"
                        score={reportData.scores?.breakdown?.data || 0}
                        color="#4caf50"
                        icon={<DataObject color="primary" />}
                        description="Data parsing & type validation (25%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <ScoreCard
                        title="Coverage"
                        score={reportData.scores?.breakdown?.coverage || 0}
                        color="#2196f3"
                        icon={<Assessment color="primary" />}
                        description="Field mapping to GETS schema (35%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <ScoreCard
                        title="Rules"
                        score={reportData.scores?.breakdown?.rules || 0}
                        color="#ff9800"
                        icon={<Rule color="primary" />}
                        description="Business rule validation (30%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <ScoreCard
                        title="Posture"
                        score={reportData.scores?.breakdown?.posture || 0}
                        color="#9c27b0"
                        icon={<Security color="primary" />}
                        description="Technical readiness (10%)"
                    />
                </Grid>
            </Grid>

            {/* Coverage Analysis */}
            <Box sx={{ mb: 4 }}>
                <CoveragePanel coverage={reportData.coverage} />
            </Box>

            {/* Rule Findings */}
            <Box sx={{ mb: 4 }}>
                <RuleFindings ruleFindings={reportData.rules?.results || reportData.ruleFindings || []} />
            </Box>

            {/* Gaps and Recommendations */}
            {reportData.gaps && reportData.gaps.length > 0 && (
                <Card variant="outlined" sx={{ mb: 4 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Key Issues to Address
                        </Typography>
                        <List>
                            {reportData.gaps.map((gap, index) => (
                                <ListItem key={index}>
                                    <ListItemIcon>
                                        <Warning color="warning" />
                                    </ListItemIcon>
                                    <ListItemText primary={gap} />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {/* AI-Powered Insights and Recommendations */}
            <Card variant="outlined" sx={{ mb: 4 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SmartToy color="primary" />
                            AI-Powered Insights & Recommendations
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={getAiInsights}
                            disabled={loadingInsights || !reportData}
                            startIcon={loadingInsights ? <CircularProgress size={16} /> : <SmartToy />}
                        >
                            {aiInsights ? 'Refresh Insights' : 'Generate Insights'}
                        </Button>
                    </Box>

                    {aiInsights ? (
                        <Box>
                            {aiInsights.overallAssessment && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>Overall Assessment</Typography>
                                    <Typography variant="body2">{aiInsights.overallAssessment}</Typography>
                                </Alert>
                            )}

                            {aiInsights.priorityIssues && aiInsights.priorityIssues.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="error.main" gutterBottom>
                                        Priority Issues to Fix
                                    </Typography>
                                    <List dense>
                                        {aiInsights.priorityIssues.map((issue, index) => (
                                            <ListItem key={index}>
                                                <ListItemIcon>
                                                    <Error color="error" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={issue.issue}
                                                    secondary={issue.recommendation}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {aiInsights.fieldMappingSuggestions && aiInsights.fieldMappingSuggestions.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                        Field Mapping Suggestions
                                    </Typography>
                                    <List dense>
                                        {aiInsights.fieldMappingSuggestions.map((suggestion, index) => (
                                            <ListItem key={index}>
                                                <ListItemIcon>
                                                    <Warning color="warning" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={suggestion.mapping}
                                                    secondary={suggestion.rationale}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {aiInsights.nextSteps && aiInsights.nextSteps.length > 0 && (
                                <Box>
                                    <Typography variant="subtitle2" color="success.main" gutterBottom>
                                        Recommended Next Steps
                                    </Typography>
                                    <List dense>
                                        {aiInsights.nextSteps.map((step, index) => (
                                            <ListItem key={index}>
                                                <ListItemIcon>
                                                    <CheckCircle color="success" />
                                                </ListItemIcon>
                                                <ListItemText primary={step} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <Alert severity="info">
                            Click "Generate Insights" to get AI-powered recommendations for improving your invoice data quality and GETS compliance.
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Actions */}
            <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Export & Share
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<Download />}
                            onClick={downloadReport}
                        >
                            Download JSON
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<Download />}
                            onClick={downloadPdf}
                            disabled={!reportData?.reportId}
                        >
                            Download PDF
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ContentCopy />}
                            onClick={copyShareUrl}
                            disabled={!shareUrl}
                        >
                            Copy Share Link
                        </Button>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<OpenInNew />}
                            onClick={openHtmlShare}
                            disabled={!shareUrl}
                        >
                            View Report
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>


                <Button
                    variant="outlined"
                    onClick={onReset}
                    startIcon={<Refresh />}
                    size="large"
                >
                    Start New Analysis
                </Button>
            </Box>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
            />
        </Box>
    );
};

export default ResultsStep;