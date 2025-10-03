import React, { useState, useCallback } from 'react';
import {
    Box,
    Button,
    Typography,
    Alert,
    Paper,
    Chip,
    CircularProgress,
    Divider,
    LinearProgress,
    Stack,
} from '@mui/material';
import {
    CloudUpload,
    ArrowForward,
    FileUpload,
    CheckCircle,
    Info,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';

const UploadStep = ({ onNext, onUploadData, contextData, setReportData }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadData, setUploadData] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);

    const getDataType = useCallback((value) => {
        if (value === null || value === undefined || value === '') return 'empty';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (value instanceof Date || !isNaN(Date.parse(value))) return 'date';
        if (typeof value === 'string' && value.includes('@')) return 'email';
        return 'text';
    }, []);

    const getTypeColor = useCallback((value) => {
        const type = getDataType(value);
        const colorMap = {
            number: 'primary',
            date: 'secondary',
            email: 'success',
            boolean: 'warning',
            empty: 'error',
            text: 'default',
        };
        return colorMap[type] || 'default';
    }, [getDataType]);

    const parseCSVPreview = useCallback((csvText) => {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                setError('CSV must have at least a header row and one data row');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const dataLines = lines.slice(1, 21); // Preview first 20 rows

            const rows = dataLines.map((line, index) => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const rowData = { id: index };
                headers.forEach((header, i) => {
                    rowData[header] = values[i] || '';
                });
                return rowData;
            });

            const columns = headers.map(header => ({
                field: header,
                headerName: header,
                width: 150,
                renderCell: (params) => (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <span>{params.value}</span>
                        <Chip
                            size="small"
                            label={getDataType(params.value)}
                            sx={{ ml: 1, fontSize: '0.6rem', height: 16 }}
                            color={getTypeColor(params.value)}
                        />
                    </Box>
                ),
            }));

            setPreviewData({ rows, columns, totalRows: lines.length - 1 });
        } catch {
            setError('Invalid CSV format');
        }
    }, [getDataType, getTypeColor]);

    const parseJSONPreview = useCallback((jsonText) => {
        try {
            const data = JSON.parse(jsonText);
            const array = Array.isArray(data) ? data : [data];
            const preview = array.slice(0, 20);

            if (preview.length === 0) return;

            const allKeys = new Set();
            preview.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    Object.keys(item).forEach(key => allKeys.add(key));
                }
            });

            const columns = Array.from(allKeys).map(key => ({
                field: key,
                headerName: key,
                width: 150,
                renderCell: (params) => (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <span>{String(params.value || '')}</span>
                        <Chip
                            size="small"
                            label={getDataType(params.value)}
                            sx={{ ml: 1, fontSize: '0.6rem', height: 16 }}
                            color={getTypeColor(params.value)}
                        />
                    </Box>
                ),
            }));

            const rows = preview.map((item, index) => ({
                id: index,
                ...item,
            }));

            setPreviewData({ rows, columns, totalRows: array.length });
        } catch {
            setError('Invalid JSON format');
        }
    }, [getDataType, getTypeColor]);

    const generatePreview = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            if (file.name.endsWith('.csv')) {
                parseCSVPreview(content);
            } else if (file.name.endsWith('.json')) {
                parseJSONPreview(content);
            }
        };
        reader.readAsText(file);
    }, [parseCSVPreview, parseJSONPreview]);

    const handleFileUpload = useCallback(async (file) => {
        setLoading(true);
        setError('');
        setUploadProgress(0);

        try {
            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('https://complyance-internship-assignment-zk.vercel.app/upload', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            setUploadData(data);
            onUploadData(data);
            generatePreview(file);
        } catch (err) {
            setError(err.message || 'Upload failed. Please try again.');
            setSelectedFile(null);
            setPreviewData(null);
            setUploadProgress(0);
        } finally {
            setLoading(false);
        }
    }, [onUploadData, generatePreview]);

    const handleFileSelect = useCallback((file) => {
        if (!file) return;

        const validTypes = ['text/csv', 'application/json'];
        const validExtensions = ['.csv', '.json'];

        const isValidType = validTypes.includes(file.type) ||
            validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            setError('Please select a CSV or JSON file');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setError('File size must be less than 10MB');
            return;
        }

        setSelectedFile(file);
        setError('');
        setPreviewData(null);
        setUploadData(null);
        handleFileUpload(file);
    }, [handleFileUpload]);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files[0]) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const handleInputChange = useCallback((e) => {
        const files = e.target.files;
        if (files && files[0]) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const handleAnalyze = useCallback(async () => {
        if (!uploadData) return;

        setAnalyzing(true);
        setError('');

        try {
            const response = await fetch('https://complyance-internship-assignment-zk.vercel.app/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uploadId: uploadData.uploadId,
                    questionnaire: contextData.questionnaire || {
                        webhooks: false,
                        sandbox_env: false,
                        retries: false
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const reportData = await response.json();
            setReportData(reportData);
            onNext();
        } catch (err) {
            setError(err.message || 'Analysis failed. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    }, [uploadData, contextData, setReportData, onNext]);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Upload Invoice Data
            </Typography>

            {/* Upload Area */}
            <Paper
                sx={{
                    p: 4,
                    mb: 3,
                    border: 2,
                    borderStyle: 'dashed',
                    borderColor: dragActive ? 'primary.main' : 'grey.300',
                    bgcolor: dragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                    },
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input
                    id="file-input"
                    type="file"
                    accept=".csv,.json"
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                />

                <Stack spacing={2} alignItems="center">
                    <CloudUpload sx={{ fontSize: 64, color: 'primary.main' }} />
                    <Typography variant="h6" textAlign="center">
                        {dragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                        or click to browse files
                    </Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                        Supported formats: CSV, JSON (max 10MB)
                    </Typography>
                </Stack>
            </Paper>

            {/* File Info */}
            {selectedFile && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <FileUpload color="primary" />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {selectedFile.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Unknown type'}
                            </Typography>
                        </Box>
                        {uploadData && <CheckCircle color="success" />}
                    </Stack>

                    {loading && (
                        <Box sx={{ mt: 2 }}>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                                <CircularProgress size={20} />
                                <Typography variant="body2">
                                    Uploading... {uploadProgress}%
                                </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={uploadProgress} />
                        </Box>
                    )}
                </Paper>
            )}

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Data Preview */}
            {previewData && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Info color="primary" />
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                            Data Preview
                        </Typography>
                        <Chip
                            label={`${previewData.totalRows} total rows`}
                            color="primary"
                            variant="outlined"
                            size="small"
                        />
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Showing first {Math.min(20, previewData.rows.length)} rows with data type indicators
                    </Typography>

                    <Box sx={{ height: 400, width: '100%' }}>
                        <DataGrid
                            rows={previewData.rows}
                            columns={previewData.columns}
                            pageSize={10}
                            rowsPerPageOptions={[10]}
                            disableSelectionOnClick
                            density="compact"
                            sx={{
                                '& .MuiDataGrid-cell': {
                                    fontSize: '0.875rem',
                                },
                                '& .MuiDataGrid-columnHeaderTitle': {
                                    fontWeight: 600,
                                },
                            }}
                        />
                    </Box>
                </Paper>
            )}

            {/* Legend */}
            {previewData && (
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
                        Data Type Legend:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label="number" color="primary" size="small" />
                        <Chip label="date" color="secondary" size="small" />
                        <Chip label="email" color="success" size="small" />
                        <Chip label="boolean" color="warning" size="small" />
                        <Chip label="text" color="default" size="small" />
                        <Chip label="empty" color="error" size="small" />
                    </Stack>
                </Paper>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    onClick={handleAnalyze}
                    disabled={!uploadData || analyzing}
                    endIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                    size="large"
                    sx={{ px: 4 }}
                >
                    {analyzing ? 'Analyzing...' : 'Analyze Data'}
                </Button>
            </Box>
        </Box>
    );
};

export default UploadStep;