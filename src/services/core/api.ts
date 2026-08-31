import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { requestMonitor } from '@/utils/requestMonitor';
import apiAuth from '@/services/core/apiAuth';
import { applySetupInterceptor } from '@/services/core/setupInterceptor';
import { getClientModeToken } from '@/store/clientModeStore';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let isTerminatingSession = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const terminateSession = () => {
  if (isTerminatingSession) return;
  isTerminatingSession = true;

  try {
    window.dispatchEvent(new CustomEvent('evolution:auth-lost'));
  } catch {
    // noop
  }

  useAuthStore.getState().clearUser();
};

api.interceptors.request.use(config => {
  const requestId = requestMonitor.logRequest(
    config.method?.toUpperCase() || 'GET',
    config.url || '',
  );

  (config as AxiosRequestConfig & { requestId?: string; requestStartTime?: number }).requestId = requestId;
  (config as AxiosRequestConfig & { requestId?: string; requestStartTime?: number }).requestStartTime = Date.now();

  // Modo Cliente (super-admin): usa o token cunhado dentro do cliente.
  const clientToken = getClientModeToken();
  if (clientToken) {
    config.headers.Authorization = `Bearer ${clientToken}`;
  } else {
    const authHeader = useAuthStore.getState().getAuthHeader();
    if (authHeader) {
      config.headers.Authorization = authHeader.Authorization;
    }
  }

  // Upload de arquivo: o Content-Type TEM que sair, sempre.
  //
  // Esta guarda existia, mas com a condição invertida: ela só apagava o cabeçalho
  // quando ele já estava ausente — e ele NUNCA está, porque o `axios.create` acima
  // define 'application/json' como padrão do cliente. Ou seja, era um no-op.
  //
  // O estrago: com Content-Type application/json e corpo FormData, o axios SERIALIZA
  // o FormData como JSON (`formDataToJSON`). O arquivo vira `{}` e o servidor recebe
  // uma requisição SEM arquivo nenhum — sem erro, sem pista. Foi o que fez o upload da
  // Base de Conhecimento da IA Vendedora falhar com "o arquivo não passou pelo passo
  // de guardar", e o que levou três consertos no backend a não mudarem nada: lá o
  // arquivo nunca chegava.
  //
  // Apagar sempre (e não só quando é JSON) é o correto: multipart precisa do boundary,
  // que só o navegador sabe gerar. Cabeçalho escrito à mão fica sem boundary; o adapter
  // do axios já o remove nesse caso, então quem sobrescreve com 'multipart/form-data'
  // não regride.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  return config;
});

api.interceptors.response.use(
  response => {
    const config = response.config as AxiosRequestConfig & { requestId?: string; requestStartTime?: number };
    if (config.requestId && config.requestStartTime) {
      const duration = Date.now() - config.requestStartTime;
      requestMonitor.logResponse(config.requestId, response.status, duration);
    }

    return response;
  },
  async error => {
    const config = (error as AxiosError).config as (AxiosRequestConfig & { requestId?: string }) | undefined;
    if (config?.requestId) {
      const errorData = (error as AxiosError).response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined;
      const errorMessage =
        errorData?.error?.message ||
        errorData?.message ||
        (error as AxiosError).message ||
        'Unknown error';
      requestMonitor.logError(config.requestId, errorMessage);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Em Modo Cliente, um 401 é do token do cliente — NÃO renova nem derruba a
    // sessão raiz do super-admin. Apenas propaga o erro pra tela tratar.
    if (getClientModeToken()) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            const authHeader = useAuthStore.getState().getAuthHeader();
            if (authHeader && originalRequest.headers) {
              originalRequest.headers.Authorization = authHeader.Authorization;
            }
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await apiAuth.post('/auth/refresh');
        const refreshData = refreshResponse.data?.data || refreshResponse.data;
        const newAccessToken = refreshData?.access_token || refreshData?.token?.access_token;

        if (!newAccessToken) {
          throw new Error('New token not received');
        }

        useAuthStore.getState().setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      const isUnreadCountEndpoint = error.config?.url?.includes('/unread_count');

      if (isUnreadCountEndpoint) {
        return Promise.reject(error);
      }

      terminateSession();
    }

    if (error.response?.status === 403) {
      // Escape hatch explícito: escrita de fundo que não deve gritar.
      if ((error.config as { silentForbidden?: boolean } | undefined)?.silentForbidden) {
        return Promise.reject(error);
      }

      // LEITURA RECUSADA NÃO GRITA. O aviso é para o CLIQUE.
      //
      // O corretor entrava no CRM e levava uma sequência de erros vermelhos sem
      // ter tocado em nada: o backend passou a conferir o cargo em TODA a API, e
      // aqui toda recusa virava toast — inclusive a dos pedidos que a própria
      // tela dispara sozinha pra se montar. Só de abrir o app, a busca dos
      // aplicativos do painel (chave que só o Administrador tem) já pintava um
      // vermelho em cima de uma tela que estava funcionando.
      //
      // A regra por VERBO, e não uma marca por chamada, é de propósito: o cargo
      // Corretor é uma lista fixa no servidor, então cada tela nova que ganha um
      // botão nasce com uma chave que ele não tem. Marcar chamada por chamada
      // consertaria as de hoje e a próxima tela recriaria o problema.
      //
      // GET recusado = aquele pedaço da tela simplesmente não aparece, que é o
      // que o app já faz com o item de menu e com os blocos de gestão do
      // dashboard. Escrita recusada continua avisando: sem o aviso, o botão "não
      // faz nada" e vira chamado de suporte.
      const metodo = (error.config?.method ?? 'get').toLowerCase();
      if (metodo === 'get' || metodo === 'head' || metodo === 'options') {
        return Promise.reject(error);
      }

      const required = error.response?.data?.required_permission;
      toast.error(
        required
          ? `Seu cargo não permite esta ação (${required})`
          : 'Seu cargo não permite esta ação',
        { id: `rbac-403-${required ?? 'generic'}` },
      );
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

applySetupInterceptor(api);

export default api;
