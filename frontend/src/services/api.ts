import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post('/auth/register', data),
  
  login: (email: string, password: string) =>
    api.post('/auth/login/json', { email, password }),
  
  getCurrentUser: () => api.get('/auth/me'),
  
  listDoctors: () => api.get('/auth/doctors'),
};

// Appointments API
export const appointmentsAPI = {
  create: (data: { doctor_id: string; scheduled_time: string; reason: string; notes?: string }) =>
    api.post('/appointments/', data),
  
  list: (status?: string) =>
    api.get('/appointments/', { params: status ? { status } : {} }),
  
  get: (id: string) => api.get(`/appointments/${id}`),
  
  update: (id: string, data: { status?: string; scheduled_time?: string; notes?: string }) =>
    api.patch(`/appointments/${id}`, data),
  
  getRoom: (id: string) => api.get(`/appointments/${id}/room`),
};

// Consent API
export const consentAPI = {
  create: (appointmentId: string) =>
    api.post('/consent/', { appointment_id: appointmentId }),
  
  get: (appointmentId: string) => api.get(`/consent/${appointmentId}`),
  
  update: (appointmentId: string, status: string) =>
    api.patch(`/consent/${appointmentId}`, { status }),
  
  check: (appointmentId: string) => api.get(`/consent/${appointmentId}/check`),
};

// Interviews API
export const interviewsAPI = {
  create: (appointmentId: string) =>
    api.post('/interviews/', { appointment_id: appointmentId }),
  
  get: (appointmentId: string) => api.get(`/interviews/${appointmentId}`),
  
  list: () => api.get('/interviews/'),
  
  startRecording: (appointmentId: string) =>
    api.post(`/interviews/${appointmentId}/start-recording`),
  
  stopRecording: (appointmentId: string) =>
    api.post(`/interviews/${appointmentId}/stop-recording`),
  
  getTranscript: (appointmentId: string) =>
    api.get(`/interviews/${appointmentId}/transcript`),
  
  uploadRecording: (appointmentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/interviews/${appointmentId}/upload-recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Real-time transcription
  startRealtime: (appointmentId: string) =>
    api.post(`/interviews/${appointmentId}/realtime/start`),
  
  addRealtimeChunk: (appointmentId: string, text: string, speaker?: string) =>
    api.post(`/interviews/${appointmentId}/realtime/chunk`, { text, speaker }),
  
  getRealtimeTranscript: (appointmentId: string) =>
    api.get(`/interviews/${appointmentId}/realtime/transcript`),
  
  endRealtime: (appointmentId: string) =>
    api.post(`/interviews/${appointmentId}/realtime/end`),
  
  // Summary
  generateSummary: (appointmentId: string) =>
    api.post(`/interviews/${appointmentId}/generate-summary`),
  
  getSummary: (appointmentId: string) =>
    api.get(`/interviews/${appointmentId}/summary`),
};

// Audit API
export const auditAPI = {
  list: (params?: { action?: string; resource_type?: string; limit?: number }) =>
    api.get('/audit/', { params }),
  
  getMyActivity: (limit?: number) =>
    api.get('/audit/my-activity', { params: limit ? { limit } : {} }),
};

export default api;
