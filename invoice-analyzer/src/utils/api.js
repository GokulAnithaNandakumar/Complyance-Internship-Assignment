// API Configuration and utilities
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  baseURL: API_BASE_URL,

  // Endpoints
  endpoints: {
    upload: '/upload',
    analyze: '/analyze',
    share: '/share',     // Updated from /report to /share
    reports: '/reports',
    health: '/health',
    aiInsights: '/ai-insights'
  },

  // Helper methods
  getReportUrl: (reportId) => `${API_BASE_URL}/share/${reportId}`,
  getShareUrl: (reportId) => `${window.location.origin}/share/${reportId}`,
  getPdfUrl: (reportId) => `${API_BASE_URL}/share/${reportId}/pdf`,
};

export default api;