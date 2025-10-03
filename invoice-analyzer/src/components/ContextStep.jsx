import React from 'react';
import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Button,
    Card,
    CardContent,
    Grid,
    Chip,
    Alert,
    Divider
} from '@mui/material';
import { ArrowForward, Business, Language } from '@mui/icons-material';

const countries = [
    { code: 'UAE', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: 'KSA', name: 'Kingdom of Saudi Arabia', flag: '🇸🇦' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
    { code: 'US', name: 'United States', flag: '🇺🇸' }
];

const erpSystems = [
    'SAP',
    'Oracle ERP',
    'Microsoft Dynamics',
    'NetSuite',
    'Sage',
    'QuickBooks',
    'Xero',
    'Zoho Books',
    'FreshBooks',
    'Custom/Other'
];

const ContextStep = ({ contextData, setContextData, onNext }) => {
    const handleCountryChange = (event) => {
        setContextData({
            ...contextData,
            country: event.target.value
        });
    };

    const handleErpChange = (event) => {
        setContextData({
            ...contextData,
            erp: event.target.value
        });
    };

    const handleQuestionnaireChange = (field) => (event) => {
        setContextData({
            ...contextData,
            questionnaire: {
                ...contextData.questionnaire,
                [field]: event.target.checked
            }
        });
    };

    const isFormValid = contextData.country && contextData.erp;

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom align="center" color="primary">
                Business Context
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
                Provide your business context to get more accurate compliance analysis
            </Typography>

            <Grid container spacing={3}>
                {/* Country Selection */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Language color="primary" sx={{ mr: 1 }} />
                                <Typography variant="h6">Country/Region</Typography>
                            </Box>
                            <FormControl fullWidth>
                                <InputLabel>Select your country</InputLabel>
                                <Select
                                    value={contextData.country}
                                    onChange={handleCountryChange}
                                    label="Select your country"
                                >
                                    {countries.map((country) => (
                                        <MenuItem key={country.code} value={country.code}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ marginRight: 8, fontSize: '1.2em' }}>
                                                    {country.flag}
                                                </span>
                                                {country.name}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {contextData.country && (
                                <Box sx={{ mt: 2 }}>
                                    <Chip
                                        label={`Selected: ${countries.find(c => c.code === contextData.country)?.name}`}
                                        color="primary"
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* ERP System */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Business color="primary" sx={{ mr: 1 }} />
                                <Typography variant="h6">ERP System</Typography>
                            </Box>
                            <FormControl fullWidth>
                                <InputLabel>Select your ERP system</InputLabel>
                                <Select
                                    value={contextData.erp}
                                    onChange={handleErpChange}
                                    label="Select your ERP system"
                                >
                                    {erpSystems.map((erp) => (
                                        <MenuItem key={erp} value={erp}>
                                            {erp}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {contextData.erp && (
                                <Box sx={{ mt: 2 }}>
                                    <Chip
                                        label={`Selected: ${contextData.erp}`}
                                        color="secondary"
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Technical Readiness Questionnaire */}
                <Grid size={{ xs: 12 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Technical Readiness Assessment
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                This information helps us calculate your technical posture score (10% of overall readiness)
                            </Typography>

                            <FormGroup>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={contextData.questionnaire.webhooks}
                                            onChange={handleQuestionnaireChange('webhooks')}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body1">
                                                Webhook Integration Ready
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Can your system receive and process webhook notifications?
                                            </Typography>
                                        </Box>
                                    }
                                />

                                <Divider sx={{ my: 1.5 }} />

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={contextData.questionnaire.sandbox_env}
                                            onChange={handleQuestionnaireChange('sandbox_env')}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body1">
                                                Sandbox Environment Available
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Do you have a testing environment for e-invoicing integration?
                                            </Typography>
                                        </Box>
                                    }
                                />

                                <Divider sx={{ my: 1.5 }} />

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={contextData.questionnaire.retries}
                                            onChange={handleQuestionnaireChange('retries')}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body1">
                                                Retry Mechanism Implemented
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Can your system handle failed API calls with automatic retries?
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </FormGroup>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {!isFormValid && (
                <Alert severity="info" sx={{ mt: 3 }}>
                    Please select both your country and ERP system to continue.
                </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                <Button
                    variant="contained"
                    onClick={onNext}
                    disabled={!isFormValid}
                    endIcon={<ArrowForward />}
                    size="large"
                    sx={{ px: 4 }}
                >
                    Continue to Upload
                </Button>
            </Box>
        </Box>
    );
};

export default ContextStep;