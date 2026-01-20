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
      // Don't redirect to login if the 401 came from a login attempt
      const isLoginRequest = error.config?.url?.includes('/auth/login') || 
                             error.config?.url?.includes('/login');
      
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { 
    email: string; 
    password: string; 
    full_name: string; 
    role: string;
    phone: string;
    // Patient fields
    date_of_birth?: string;
    blood_group?: string;
    emergency_contact?: string;
    address?: string;
    // Doctor fields
    specialization?: string;
    license_number?: string;
    hospital_affiliation?: string;
    years_of_experience?: number;
  }) => api.post('/auth/register', data),
  
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

// Notifications API
export const notificationsAPI = {
  // Get user's notifications
  getNotifications: (limit?: number, unreadOnly?: boolean) =>
    api.get('/notifications/', { params: { limit, unread_only: unreadOnly } }),
  
  // Mark notification as read
  markAsRead: (notificationId: string) =>
    api.patch(`/notifications/${notificationId}/read`),
  
  // Mark all notifications as read
  markAllAsRead: () =>
    api.patch('/notifications/mark-all-read'),
  
  // Get unread count
  getUnreadCount: () =>
    api.get('/notifications/unread-count'),
  
  // Notify doctor that patient is waiting (call this when patient joins and doctor hasn't)
  notifyPatientWaiting: (appointmentId: string, waitingMinutes: number = 5) =>
    api.post('/notifications/patient-waiting', { 
      appointment_id: appointmentId, 
      waiting_minutes: waitingMinutes 
    }),
};

export default api;
