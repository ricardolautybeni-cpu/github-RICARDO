import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (email, password, full_name) =>
  api.post('/auth/register', { email, password, full_name });

// Products
export const getProducts = (search) =>
  api.get('/products', { params: { search } });

export const createProduct = (productData) =>
  api.post('/products', productData);

// Clients
export const getClients = (search) =>
  api.get('/clients', { params: { search } });

export const createClient = (clientData) =>
  api.post('/clients', clientData);

// Sales
export const getSales = (filters) =>
  api.get('/sales', { params: filters });

export const getSaleDetail = (saleId) =>
  api.get(`/sales/${saleId}`);

// Inventory
export const getInventory = () =>
  api.get('/inventory');

export const registerInventoryEntry = (data) =>
  api.post('/inventory/entry', data);

export default api;
