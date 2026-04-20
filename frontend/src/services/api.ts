import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    const { state } = JSON.parse(authStorage);
    if (state?.token) {
      config.headers.Authorization = `Bearer ${state.token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  pinLogin: (pin: string) =>
    api.post('/auth/pin-login', { pin }),
  getMe: () =>
    api.get('/auth/me'),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
};

export const menuApi = {
  getAll: () => api.get('/menu'),
  getById: (id: string) => api.get(`/menu/${id}`),
};

export const ordersApi = {
  create: (data: any) => api.post('/orders', data),
  getAll: (params?: any) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
  cancel: (id: string) => api.put(`/orders/${id}/cancel`),
  getTodaySummary: () => api.get('/orders/today/summary'),
};

export const paymentsApi = {
  processCash: (orderId: string, amountTendered: number) =>
    api.post('/payments/cash', { orderId, amountTendered }),
  processEcocash: (orderId: string, phoneNumber: string) =>
    api.post('/payments/ecocash', { orderId, phoneNumber }),
  processInnbucks: (orderId: string) =>
    api.post('/payments/innbucks', { orderId }),
  processZipit: (orderId: string) =>
    api.post('/payments/zipit', { orderId }),
  processCard: (orderId: string) =>
    api.post('/payments/card', { orderId }),
  getStatus: (orderId: string) =>
    api.get(`/payments/${orderId}/status`),
  confirm: (orderId: string) =>
    api.post('/payments/confirm', { orderId }),
};
