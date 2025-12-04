import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Admin API functions
export const adminAPI = {
  // Parcels
  getParcels: (params) => api.get('/admin/parcels', { params }),
  
  // Seeder
  seedParcels: (data) => api.post('/admin/seed', data),
  
  // KYC
  verifyKYC: (userId, status) => api.post(`/admin/kyc/verify/${userId}`, { status }),
  getPendingKYC: (params) => api.get('/admin/kyc/pending', { params }),
  
  // Transactions
  getTransactionLogs: (params) => api.get('/admin/logs/transactions', { params }),
  
  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  
  // Stats
  getStats: () => api.get('/admin/stats'),
};

export default api;

