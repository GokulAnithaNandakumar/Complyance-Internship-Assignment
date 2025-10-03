import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Card,
    CardContent,
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
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Pagination,
    AppBar,
    Toolbar,
    Fab,
    Grid,
    Tooltip
} from '@mui/material';
import {
    OpenInNew,
    Refresh,
    Assessment,
    ArrowBack,
    Home,
    Email,
    Download,
    Share,
    FilterList
} from '@mui/icons-material';
import axios from 'axios';
import { formatDate, getReadinessLevel } from '../utils/helpers';
import { api } from '../utils/api';

const AllReportsPage = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalReports, setTotalReports] = useState(0);
    const [emailDialog, setEmailDialog] = useState({ open: false, reportId: null });
    const [emailAddress, setEmailAddress] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState(null);
    
    const reportsPerPage = 20;

    const fetchReports = async (pageNum = 1) => {
        setLoading(true);
        setError(null);

        try {
            // Fetch more reports for the all reports page
            const response = await axios.get(
                `${api.baseURL}${api.endpoints.reports}?limit=${reportsPerPage * pageNum}`
            );
            const allReports = response.data.reports || [];
            setReports(allReports);
            setTotalReports(allReports.length);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports(page);
    }, [page]);

    const handleEmailReport = async (reportId) => {
        setEmailDialog({ open: true, reportId });
        setEmailAddress('');
        setEmailSuccess(null);
    };

    const sendEmailReport = async () => {
        if (!emailAddress || !emailDialog.reportId) return;

        setEmailSending(true);
        try {
            await axios.post(
                `${api.baseURL}/share/${emailDialog.reportId}/email`,
                { email: emailAddress }
            );
            setEmailSuccess('Report link sent successfully!');
            setTimeout(() => {
                setEmailDialog({ open: false, reportId: null });
                setEmailSuccess(null);
            }, 2000);
        } catch (error) {
            setEmailSuccess(error.response?.data?.message || 'Failed to send email');
        } finally {
            setEmailSending(false);
        }
    };

    const downloadPDF = (reportId) => {
        const pdfUrl = `${api.baseURL}/share/${reportId}/pdf`;
        window.open(pdfUrl, '_blank');
    };

    const viewReport = (reportId) => {
        navigate(`/share/${reportId}`);
    };

    const shareReport = async (reportId) => {
        const shareUrl = `${window.location.origin}/share/${reportId}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'E-Invoicing Readiness Report',
                    text: 'Check out this invoice readiness analysis report',
                    url: shareUrl
                });
            } catch {
                // Fallback to clipboard
                copyToClipboard(shareUrl);
            }
        } else {
            copyToClipboard(shareUrl);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            // You could add a toast notification here
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        return 'error';
    };

    const paginatedReports = reports.slice((page - 1) * reportsPerPage, page * reportsPerPage);
    const totalPages = Math.ceil(totalReports / reportsPerPage);

    if (loading) {
        return (
            <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                minHeight="100vh"
                flexDirection="column"
            >
                <CircularProgress size={48} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    Loading reports...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            {/* App Bar */}
            <AppBar position="sticky" sx={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <Toolbar>
                    <IconButton 
                        edge="start" 
                        color="inherit" 
                        onClick={() => navigate('/')}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBack />
                    </IconButton>
                    <Assessment sx={{ mr: 2 }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        All Reports
                    </Typography>
                    <Tooltip title="Refresh">
                        <IconButton color="inherit" onClick={() => fetchReports(page)}>
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ py: 4 }}>
                {/* Header Stats */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="primary">
                                    {totalReports}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Reports
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="success.main">
                                    {reports.filter(r => (r.scores_overall || r.overallScore || 0) >= 80).length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    High Readiness
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="warning.main">
                                    {reports.filter(r => {
                                        const score = r.scores_overall || r.overallScore || 0;
                                        return score >= 60 && score < 80;
                                    }).length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Medium Readiness
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" color="error.main">
                                    {reports.filter(r => (r.scores_overall || r.overallScore || 0) < 60).length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Low Readiness
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Reports Table */}
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderRadius: 3 }}>
                    <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h5" fontWeight="bold">
                                All Analysis Reports
                            </Typography>
                            <Box>
                                <Button
                                    startIcon={<Home />}
                                    variant="outlined"
                                    onClick={() => navigate('/')}
                                    sx={{ mr: 1 }}
                                >
                                    New Analysis
                                </Button>
                            </Box>
                        </Box>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {reports.length === 0 ? (
                            <Box textAlign="center" py={8}>
                                <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No reports found
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Complete an analysis to see reports here.
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    startIcon={<Home />}
                                    onClick={() => navigate('/')}
                                >
                                    Start New Analysis
                                </Button>
                            </Box>
                        ) : (
                            <>
                                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Report ID</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Date Created</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Overall Score</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Readiness</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {paginatedReports.map((report) => {
                                                const reportId = report.reportId || report.id;
                                                const score = report.scores_overall || report.overallScore || 0;
                                                const readiness = getReadinessLevel(score);
                                                
                                                return (
                                                    <TableRow key={reportId} hover>
                                                        <TableCell>
                                                            <Typography variant="body2" fontFamily="monospace">
                                                                {reportId?.substring(0, 12)}...
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {formatDate(report.created_at || report.createdAt)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Chip
                                                                label={`${score}%`}
                                                                color={getScoreColor(score)}
                                                                variant="filled"
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Chip
                                                                label={readiness}
                                                                color={getScoreColor(score)}
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Box display="flex" justifyContent="center" gap={0.5}>
                                                                <Tooltip title="View Report">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={() => viewReport(reportId)}
                                                                        color="primary"
                                                                    >
                                                                        <OpenInNew fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Download PDF">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={() => downloadPDF(reportId)}
                                                                        color="success"
                                                                    >
                                                                        <Download fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Email Report">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={() => handleEmailReport(reportId)}
                                                                        color="info"
                                                                    >
                                                                        <Email fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Share">
                                                                    <IconButton 
                                                                        size="small" 
                                                                        onClick={() => shareReport(reportId)}
                                                                        color="secondary"
                                                                    >
                                                                        <Share fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <Box display="flex" justifyContent="center">
                                        <Pagination
                                            count={totalPages}
                                            page={page}
                                            onChange={(event, value) => setPage(value)}
                                            color="primary"
                                        />
                                    </Box>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </Container>

            {/* Email Dialog */}
            <Dialog 
                open={emailDialog.open} 
                onClose={() => setEmailDialog({ open: false, reportId: null })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center">
                        <Email sx={{ mr: 1 }} />
                        Email Report Link
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Send a link to this report via email. The recipient will receive both a web link and PDF download option.
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Email Address"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        disabled={emailSending}
                    />
                    {emailSuccess && (
                        <Alert 
                            severity={emailSuccess.includes('successfully') ? 'success' : 'error'} 
                            sx={{ mt: 2 }}
                        >
                            {emailSuccess}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setEmailDialog({ open: false, reportId: null })}
                        disabled={emailSending}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={sendEmailReport}
                        variant="contained"
                        disabled={!emailAddress || emailSending}
                        startIcon={emailSending ? <CircularProgress size={16} /> : <Email />}
                    >
                        {emailSending ? 'Sending...' : 'Send Email'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Floating Action Button */}
            <Fab
                color="primary"
                aria-label="new analysis"
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
                onClick={() => navigate('/')}
            >
                <Home />
            </Fab>
        </Box>
    );
};

export default AllReportsPage;