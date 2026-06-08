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
  create: (payload: { name: string; sortOrder?: number }) =>
    api.post('/categories', payload),
  update: (id: string, payload: { name?: string; sortOrder?: number }) =>
    api.put(`/categories/${id}`, payload),
  remove: (id: string) => api.delete(`/categories/${id}`),
};

export const menuApi = {
  getAll: () => api.get('/menu'),
  getById: (id: string) => api.get(`/menu/${id}`),
  create: (payload: {
    categoryId: string; name: string; price: number;
    description?: string; prepTimeMinutes?: number; sortOrder?: number;
  }) => api.post('/menu', payload),
  update: (id: string, payload: {
    categoryId?: string; name?: string; price?: number;
    description?: string; prepTimeMinutes?: number; sortOrder?: number;
  }) => api.put(`/menu/${id}`, payload),
  toggle: (id: string) => api.put(`/menu/${id}/toggle`),
  remove: (id: string) => api.delete(`/menu/${id}`),
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

export const receiptsApi = {
  get: (orderId: string) => api.get(`/receipts/${orderId}`),
  // Public HTML URL (no /api prefix) — for WhatsApp & browser print fallback
  htmlUrl: (orderId: string) => {
    const base = API_URL.replace(/\/api\/?$/, '');
    return `${base}/receipts/${orderId}`;
  },
};

export const statsApi = {
  dashboard: (params?: { range?: string; from?: string; to?: string }) =>
    api.get('/stats/dashboard', { params }),
};

export const inventoryApi = {
  list: () => api.get('/inventory'),
  restock: (menuItemId: string, payload: { quantity: number; mode?: 'add' | 'set'; lowStockThreshold?: number }) =>
    api.post(`/inventory/${menuItemId}/restock`, payload),
  // Stock receipts (weekly batches)
  listReceipts: (params?: { from?: string; to?: string; menuItemId?: string; limit?: number }) =>
    api.get('/inventory/receipts', { params }),
  receiptsSummary: () => api.get('/inventory/receipts/summary'),
  createReceipts: (payload: {
    receivedAt?: string;
    supplier?: string;
    notes?: string;
    items: { menuItemId: string; quantity: number; unitCost?: number }[];
  }) => api.post('/inventory/receipts', payload),
  deleteReceipt: (id: string) => api.delete(`/inventory/receipts/${id}`),
};

export const ingredientsApi = {
  list: () => api.get('/ingredients'),
  create: (payload: {
    name: string; unit?: string; quantity?: number;
    lowStockThreshold?: number; unitCost?: number; notes?: string;
  }) => api.post('/ingredients', payload),
  update: (id: string, payload: {
    name?: string; unit?: string; lowStockThreshold?: number;
    unitCost?: number; notes?: string;
  }) => api.patch(`/ingredients/${id}`, payload),
  remove: (id: string) => api.delete(`/ingredients/${id}`),
  restock: (id: string, payload: { quantity: number; mode?: 'add' | 'set'; lowStockThreshold?: number }) =>
    api.post(`/ingredients/${id}/restock`, payload),
  // Receipts (deliveries)
  listReceipts: (params?: { from?: string; to?: string; ingredientId?: string; limit?: number }) =>
    api.get('/ingredients/receipts', { params }),
  createReceipts: (payload: {
    receivedAt?: string; supplier?: string; notes?: string;
    items: { ingredientId: string; quantity: number; unitCost?: number }[];
  }) => api.post('/ingredients/receipts', payload),
  deleteReceipt: (id: string) => api.delete(`/ingredients/receipts/${id}`),
};

export const recipesApi = {
  listOverview: () => api.get('/recipes'),
  get: (menuItemId: string) => api.get(`/recipes/${menuItemId}`),
  set: (menuItemId: string, items: { ingredientId: string; quantityPerUnit: number }[]) =>
    api.put(`/recipes/${menuItemId}`, { items }),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (payload: {
    name: string; role: 'admin' | 'manager' | 'cashier' | 'kitchen';
    email?: string; password?: string; pin?: string;
  }) => api.post('/users', payload),
  update: (id: string, payload: {
    name?: string; email?: string; role?: 'admin' | 'manager' | 'cashier' | 'kitchen';
    isActive?: boolean; password?: string; pin?: string;
  }) => api.patch(`/users/${id}`, payload),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export const shiftsApi = {
  current: () => api.get('/shifts/current'),
  open: (openingFloat: number) => api.post('/shifts/open', { openingFloat }),
  close: (closingFloat: number) => api.post('/shifts/close', { closingFloat }),
  zReport: (shiftId: string) => api.get(`/shifts/${shiftId}/z-report`),
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
