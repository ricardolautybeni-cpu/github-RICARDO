import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

let token = null;

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const storedToken = await SecureStore.getItemAsync('auth_token');
  if (storedToken) {
    config.headers.Authorization = `Bearer ${storedToken}`;
  }
  return config;
});

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  const accessToken = response.data.accessToken || response.data.token;
  if (accessToken) {
    token = accessToken;
    await SecureStore.setItemAsync('auth_token', accessToken);
  }
  return response.data;
};

export const getProducts = async (search = '') => {
  return api.get('/products', { params: { search } });
};

export const getProductByCode = async (code) => {
  return api.get(`/products/code/${code}`);
};

export const createSale = async (saleData) => {
  return api.post('/sales', saleData);
};

export const getClients = async (search = '') => {
  return api.get('/clients', { params: { search } });
};

export const createClient = async (clientData) => {
  return api.post('/clients', clientData);
};

export const getClientLastSales = async (clientId) => {
  return api.get(`/clients/${clientId}/last-sales`);
};

export const getInventory = async () => {
  return api.get('/inventory');
};

export default api;
