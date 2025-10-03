import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Box,
    Alert,
    CircularProgress,
    Button
} from '@mui/material';
import {
    OpenInNew,
    Refresh,
    Assessment,
    ViewList
} from '@mui/icons-material';
import axios from 'axios';
import { formatDate, getReadinessLevel } from '../utils/helpers';
import { api } from '../utils/api';

const RecentReports = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${api.baseURL}${api.endpoints.reports}?limit=10`);
            setReports(response.data.reports || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch recent reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleOpenReport = (reportId) => {
        navigate(`/report/${reportId}`);
    };

    if (loading) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={40} />
                        <Typography variant="body1" sx={{ ml: 2 }}>
                            Loading recent reports...
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card variant="outlined">
                <CardContent>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                    <Button
                        variant="outlined"
                        onClick={fetchReports}
                        startIcon={<Refresh />}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Assessment sx={{ mr: 1 }} />
                        Recent Analysis Reports
                    </Typography>
                    <IconButton onClick={fetchReports} size="small">
                        <Refresh />
                    </IconButton>
                </Box>

                {reports.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        No recent reports found. Complete an analysis to see reports here.
                    </Typography>
                ) : (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Report ID</TableCell>
                                    <TableCell>Date Created</TableCell>
                                    <TableCell align="center">Overall Score</TableCell>
                                    <TableCell align="center">Readiness</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map((report) => {
                                    const reportId = report.reportId || report.id;
                                    const readiness = getReadinessLevel(report.scores_overall || report.overallScore || 0);

                                    return (
                                        <TableRow key={reportId || Math.random()} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontFamily="monospace">
                                                    {(reportId || 'N/A').substring(0, 8)}...
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {formatDate(report.created_at || report.createdAt)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography variant="h6" fontWeight="bold">
                                                    {report.scores_overall || report.overallScore || 0}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={readiness.label || readiness}
                                                    color={readiness.color || 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenReport(reportId)}
                                                    title="Open report"
                                                    disabled={!reportId}
                                                >
                                                    <OpenInNew />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* See More Button */}
                {reports.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ViewList />}
                            onClick={() => navigate('/reports')}
                            size="small"
                        >
                            See All Reports
                        </Button>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default RecentReports;