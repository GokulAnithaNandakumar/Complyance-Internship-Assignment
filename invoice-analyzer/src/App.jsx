import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { ThemeContextProvider } from './contexts/ThemeContext';
import { useTheme } from './hooks/useTheme';
import MainApp from './components/MainApp';
import ReportPage from './components/ReportPage';
import AllReportsPage from './components/AllReportsPage';

const AppContent = () => {
  const { darkMode } = useTheme();

  // Create theme based on dark mode state
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

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
};

function App() {
  return (
    <ThemeContextProvider>
      <AppContent />
    </ThemeContextProvider>
  );
}

export default App;
