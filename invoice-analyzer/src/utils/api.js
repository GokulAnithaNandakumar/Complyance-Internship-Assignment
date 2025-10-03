// API Configuration and utilities
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://complyance-internship-assignment-zk.vercel.app';

export const api = {
  baseURL: API_BASE_URL,

  // Endpoints
  endpoints: {
    upload: '/upload',
    analyze: '/analyze',
    report: '/report',
    reports: '/reports',
    health: '/health'
  },

  // Helper methods
  getReportUrl: (reportId) => `${API_BASE_URL}/report/${reportId}`,
  getShareUrl: (reportId) => `${window.location.origin}/report/${reportId}`,
};

export default api;