import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://complyance-internship-assignment-zk.vercel.app';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiService = {
  // Upload file or text data
  upload: async (data) => {
    if (data instanceof FormData) {
      return api.post('/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      return api.post('/upload', data);
    }
  },

  // Analyze uploaded data
  analyze: async (uploadId, questionnaire) => {
    return api.post('/analyze', {
      uploadId,
      questionnaire,
    });
  },

  // Get report by ID
  getReport: async (reportId) => {
    return api.get(`/report/${reportId}`);
  },

  // Get recent reports
  getRecentReports: async (limit = 10) => {
    return api.get(`/reports?limit=${limit}`);
  },

  // Health check
  health: async () => {
    return api.get('/health');
  },
};

export default api;