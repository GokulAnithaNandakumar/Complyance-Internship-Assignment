import React, { useState } from 'react';
import {
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
    Tooltip
} from '@mui/material';
import { AssignmentInd, CloudUpload, Assessment, DarkMode, LightMode } from '@mui/icons-material';
import { useTheme } from '../hooks/useTheme';

// Import step components
import ContextStep from './ContextStep';
import UploadStep from './UploadStep';
import ResultsStep from './ResultsStep';
import ErrorBoundary from './ErrorBoundary';
import RecentReports from './RecentReports';

const MainApp = () => {
    const [activeStep, setActiveStep] = useState(0);
    const { darkMode, toggleTheme } = useTheme();

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
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="static" elevation={0}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        E-Invoicing Readiness Analyzer
                    </Typography>
                    <Tooltip title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        <IconButton
                            color="inherit"
                            onClick={toggleTheme}
                            sx={{ ml: 2 }}
                        >
                            {darkMode ? <LightMode /> : <DarkMode />}
                        </IconButton>
                    </Tooltip>
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
    );
};

export default MainApp;