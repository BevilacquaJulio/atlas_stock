import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStore } from './token-store';
import { financeiroUnlockStore } from './financeiro-unlock';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

/** Cliente HTTP central. Toda chamada à API passa por aqui. */
export const api = axios.create({ baseURL });

/** Emitido quando a sessão expira de vez (refresh falhou). */
export const SESSION_EXPIRED_EVENT = 'g5:session-expired';

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const url = config.url ?? '';
  if (url.includes('/financeiro') && !url.includes('/desbloquear')) {
    const finToken = financeiroUnlockStore.get();
    if (finToken) {
      config.headers['X-Financeiro-Token'] = finToken;
    }
  }
  return config;
});

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshingPromise: Promise<string> | null = null;

/** Renova access token usando o refresh token persistido. */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('Sem refresh token.');

  // axios "cru" para não recair no interceptor e evitar loop.
  const { data } = await axios.post<{
    accessToken: string;
    refreshToken: string;
  }>(`${baseURL}/auth/refresh`, { refreshToken });

  tokenStore.setAccess(data.accessToken);
  tokenStore.setRefresh(data.refreshToken);
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;

    const isPublicAuthRoute =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/logout');

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isPublicAuthRoute
    ) {
      original._retry = true;
      try {
        refreshingPromise = refreshingPromise ?? refreshAccessToken();
        const newToken = await refreshingPromise;
        refreshingPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshingPromise = null;
        tokenStore.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

/** Extrai a mensagem do envelope de erro do backend `{ error: { code, message } }`. */
export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro.'): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { error?: { message?: string } }
      | undefined;
    return data?.error?.message ?? error.message ?? fallback;
  }
  return fallback;
}
