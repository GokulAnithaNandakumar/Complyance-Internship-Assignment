import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    AppBar,
    Toolbar,
    Typography,
    Box,
    Paper,
    IconButton,
    CircularProgress,
    Alert,
    Button,
    ThemeProvider,
    createTheme,
    CssBaseline,
    useMediaQuery
} from '@mui/material';
import { ArrowBack, Home, Brightness4, Brightness7 } from '@mui/icons-material';
import ResultsStep from './ResultsStep';
import axios from 'axios';

const API_BASE_URL = 'https://complyance-internship-assignment-backend.onrender.com';

const ReportPage = () => {
    const { reportId } = useParams();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [darkMode, setDarkMode] = useState(prefersDarkMode);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: darkMode ? 'dark' : 'light',
                    primary: {
                        main: '#1976d2',
                    },
                    secondary: {
                        main: '#dc004e',
                    },
                    background: {
                        default: darkMode ? '#121212' : '#f5f5f5',
                    },
                },
                typography: {
                    h4: {
                        fontWeight: 600,
                    },
                    h6: {
                        fontWeight: 500,
                    },
                },
                components: {
                    MuiPaper: {
                        styleOverrides: {
                            root: {
                                backgroundImage: darkMode ? 'none' : undefined,
                            },
                        },
                    },
                },
            }),
        [darkMode]
    );

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/share/${reportId}`);
                setReportData(response.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load report');
            } finally {
                setLoading(false);
            }
        };

        if (reportId) {
            fetchReport();
        }
    }, [reportId]);

    const handleGoHome = () => {
        navigate('/');
    };

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                    <Container maxWidth="xl">
                        <AppBar position="static" elevation={0} sx={{ mb: 4 }}>
                            <Toolbar>
                                <IconButton
                                    edge="start"
                                    color="inherit"
                                    onClick={handleBack}
                                    sx={{ mr: 2 }}
                                >
                                    <ArrowBack />
                                </IconButton>
                                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                                    Loading Report backend hosted on render so it may take upto a minute for the server to boot up...
                                </Typography>
                                <IconButton
                                    color="inherit"
                                    onClick={() => setDarkMode(!darkMode)}
                                    sx={{ mr: 2 }}
                                >
                                    {darkMode ? <Brightness7 /> : <Brightness4 />}
                                </IconButton>
                                <IconButton color="inherit" onClick={handleGoHome}>
                                    <Home />
                                </IconButton>
                            </Toolbar>
                        </AppBar>

                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                            <CircularProgress size={60} />
                            <Typography variant="h6" sx={{ ml: 2 }}>
                                Loading report {reportId}...
                            </Typography>
                        </Box>
                    </Container>
                </Box>
            </ThemeProvider>
        );
    }

    if (error) {
        return (
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                    <Container maxWidth="xl">
                        <AppBar position="static" elevation={0} sx={{ mb: 4 }}>
                            <Toolbar>
                                <IconButton
                                    edge="start"
                                    color="inherit"
                                    onClick={handleBack}
                                    sx={{ mr: 2 }}
                                >
                                    <ArrowBack />
                                </IconButton>
                                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                                    Report Not Found
                                </Typography>
                                <IconButton
                                    color="inherit"
                                    onClick={() => setDarkMode(!darkMode)}
                                    sx={{ mr: 2 }}
                                >
                                    {darkMode ? <Brightness7 /> : <Brightness4 />}
                                </IconButton>
                                <IconButton color="inherit" onClick={handleGoHome}>
                                    <Home />
                                </IconButton>
                            </Toolbar>
                        </AppBar>

                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
                                <Typography variant="h6" gutterBottom>
                                    Report Not Found
                                </Typography>
                                <Typography variant="body1">
                                    {error}
                                </Typography>
                            </Alert>
                            <Button
                                variant="contained"
                                onClick={handleGoHome}
                                startIcon={<Home />}
                                size="large"
                            >
                                Go to Home
                            </Button>
                        </Box>
                    </Container>
                </Box>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <Container maxWidth="xl">
                    <AppBar position="static" elevation={0} sx={{ mb: 4 }}>
                        <Toolbar>
                            <IconButton
                                edge="start"
                                color="inherit"
                                onClick={handleGoHome}
                                sx={{ mr: 2 }}
                            >
                                <ArrowBack />
                            </IconButton>
                            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                                Analysis Report - {reportId}
                            </Typography>
                            <IconButton
                                color="inherit"
                                onClick={() => setDarkMode(!darkMode)}
                                sx={{ mr: 2 }}
                            >
                                {darkMode ? <Brightness7 /> : <Brightness4 />}
                            </IconButton>
                            <IconButton color="inherit" onClick={handleGoHome}>
                                <Home />
                            </IconButton>
                        </Toolbar>
                    </AppBar>

                    <Paper elevation={1} sx={{ p: 4 }}>
                        <ResultsStep
                            uploadData={null}
                            contextData={null}
                            reportData={reportData}
                            setReportData={setReportData}
                            onBack={handleBack}

                            onReset={handleGoHome}
                            isStandalonePage={true}
                        />
                    </Paper>
                </Container>
            </Box>
        </ThemeProvider>
    );
};

export default ReportPage;