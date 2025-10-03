import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import MainApp from './components/MainApp';
import ReportPage from './components/ReportPage';
import AllReportsPage from './components/AllReportsPage';

// Create a default theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/share/:reportId" element={<ReportPage />} />
          <Route path="/report/:reportId" element={<ReportPage />} />
          <Route path="/reports" element={<AllReportsPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
