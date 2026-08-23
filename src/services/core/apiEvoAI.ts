import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { applySetupInterceptor } from '@/services/core/setupInterceptor';
import { getClientModeToken } from '@/store/clientModeStore';

// Create a separate axios instance for evo-ai-core-service
const evoaiApi = axios.create({
  baseURL: `${import.meta.env.VITE_EVOAI_API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptador para incluir o access_token nos headers das requisições
evoaiApi.interceptors.request.use((config) => {
  // Modo Cliente (super-admin): token cunhado dentro do cliente vence.
  const clientToken = getClientModeToken();
  if (clientToken) {
    config.headers.Authorization = `Bearer ${clientToken}`;
  } else {
    const authHeader = useAuthStore.getState().getAuthHeader();
    if (authHeader) {
      config.headers.Authorization = authHeader.Authorization;
    }
  }

  return config;
});

// Add response interceptor for error handling and format transformation
evoaiApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearUser();
      // window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

applySetupInterceptor(evoaiApi);

export default evoaiApi;
