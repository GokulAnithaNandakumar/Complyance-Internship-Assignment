import React, { useState, useEffect } from 'react';
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
    Assessment
} from '@mui/icons-material';
import { formatDate, getReadinessLevel } from '../utils/helpers';
import { apiService } from '../services/api';

const RecentReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await apiService.getRecentReports(10);
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
        window.open(`/share/${reportId}`, '_blank');
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
                                    const readiness = getReadinessLevel(report.overallScore);
                                    // console.log(readiness);
                                    return (
                                        <TableRow key={report.reportId || report.id || Math.random()} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontFamily="monospace">
                                                    {(report.reportId || report.id || 'N/A').substring(0, 8)}...
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {formatDate(report.createdAt)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography variant="h6" fontWeight="bold">
                                                    {report.overallScore || 0}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={readiness.label}
                                                    color={readiness.color}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenReport(report.reportId)}
                                                    title="Open report"
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
            </CardContent>
        </Card>
    );
};

export default RecentReports;