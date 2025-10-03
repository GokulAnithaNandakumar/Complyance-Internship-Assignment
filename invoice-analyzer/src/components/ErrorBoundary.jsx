import React from 'react';
import {
    Box,
    Typography,
    Button,
    Alert,
    Container,
    Paper
} from '@mui/material';
import { Refresh, Warning } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to console for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <Container maxWidth="md" sx={{ mt: 4 }}>
                    <Paper elevation={3} sx={{ p: 4 }}>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <Warning color="error" sx={{ fontSize: 64, mb: 2 }} />
                            <Typography variant="h4" color="error" gutterBottom>
                                Oops! Something went wrong
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
                            </Typography>
                        </Box>

                        <Alert severity="error" sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Error Details:
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {this.state.error && this.state.error.toString()}
                            </Typography>
                        </Alert>

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="contained"
                                onClick={this.handleReload}
                                startIcon={<Refresh />}
                            >
                                Reload Page
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={this.handleReset}
                            >
                                Try Again
                            </Button>
                        </Box>

                        {import.meta.env.DEV && this.state.errorInfo && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Component Stack (Development Only):
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.100' }}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.7rem',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {this.state.errorInfo.componentStack}
                                    </Typography>
                                </Paper>
                            </Box>
                        )}
                    </Paper>
                </Container>
            );
        }

        // If no error, render children normally
        return this.props.children;
    }
}

export default ErrorBoundary;