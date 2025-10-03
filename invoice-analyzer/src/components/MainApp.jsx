import React, { useState, useMemo } from 'react';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Container,
    AppBar,
    Toolbar,
    Typography,
    Box,
    Stepper,
    Step,
    StepLabel,
    Paper,
    IconButton,
    useMediaQuery
} from '@mui/material';
import { AssignmentInd, CloudUpload, Assessment, Brightness4, Brightness7 } from '@mui/icons-material';

// Import step components
import ContextStep from './ContextStep';
import UploadStep from './UploadStep';
import ResultsStep from './ResultsStep';
import ErrorBoundary from './ErrorBoundary';
import RecentReports from './RecentReports';

const MainApp = () => {
    const [activeStep, setActiveStep] = useState(0);
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

    const steps = [
        {
            label: 'Context',
            icon: <AssignmentInd />,
            description: 'Provide business context'
        },
        {
            label: 'Upload',
            icon: <CloudUpload />,
            description: 'Upload invoice data'
        },
        {
            label: 'Results',
            icon: <Assessment />,
            description: 'View analysis results'
        }
    ];

    const [contextData, setContextData] = useState({
        country: '',
        erp: '',
        questionnaire: {
            webhooks: false,
            sandbox_env: false,
            retries: false
        }
    });
    const [uploadData, setUploadData] = useState(null);
    const [reportData, setReportData] = useState(null);

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
        setContextData({
            country: '',
            erp: '',
            questionnaire: {
                webhooks: false,
                sandbox_env: false,
                retries: false
            }
        });
        setUploadData(null);
        setReportData(null);
    };

    const getStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <ContextStep
                        contextData={contextData}
                        setContextData={setContextData}
                        onNext={handleNext}
                    />
                );
            case 1:
                return (
                    <UploadStep
                        contextData={contextData}
                        uploadData={uploadData}
                        onUploadData={setUploadData}
                        reportData={reportData}
                        setReportData={setReportData}
                        onNext={handleNext}
                        onBack={handleBack}
                    />
                );
            case 2:
                return (
                    <ResultsStep
                        uploadData={uploadData}
                        contextData={contextData}
                        reportData={reportData}
                        setReportData={setReportData}
                        onBack={handleBack}
                        onReset={handleReset}
                    />
                );
            default:
                throw new Error('Unknown step');
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AppBar position="static" elevation={0}>
                    <Toolbar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            E-Invoicing Readiness Analyzer
                        </Typography>
                        <IconButton
                            color="inherit"
                            onClick={() => setDarkMode(!darkMode)}
                            sx={{ ml: 2 }}
                        >
                            {darkMode ? <Brightness7 /> : <Brightness4 />}
                        </IconButton>
                    </Toolbar>
                </AppBar>

                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <ErrorBoundary>
                        <Paper elevation={1} sx={{ mb: 4, p: 4 }}>
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h4" gutterBottom align="center">
                                    Invoice Data Analysis
                                </Typography>
                                <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
                                    Analyze your invoice data for GETS compliance and readiness
                                </Typography>

                                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
                                    {steps.map((step) => (
                                        <Step key={step.label}>
                                            <StepLabel
                                                icon={step.icon}
                                                optional={
                                                    <Typography variant="caption">{step.description}</Typography>
                                                }
                                            >
                                                {step.label}
                                            </StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            </Box>

                            {getStepContent(activeStep)}
                        </Paper>

                        {activeStep === 0 && <RecentReports />}
                    </ErrorBoundary>
                </Container>
            </Box>
        </ThemeProvider>
    );
};

export default MainApp;