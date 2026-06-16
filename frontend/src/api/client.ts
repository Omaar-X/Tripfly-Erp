import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';
export const api = axios.create({ baseURL });

let accessToken: string | null = localStorage.getItem('tf_access');

export function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (access) localStorage.setItem('tf_access', access);
  else localStorage.removeItem('tf_access');
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem('tf_refresh', refresh);
    else localStorage.removeItem('tf_refresh');
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// On 401 → try one silent refresh-token rotation, then replay the request.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as typeof error.config & { _retried?: boolean };
  if (error.response?.status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
    original._retried = true;
    refreshing ??= (async () => {
      try {
        const refreshToken = localStorage.getItem('tf_refresh');
        if (!refreshToken) return null;
        const { data } = await axios.post(`${baseURL}/api/auth/refresh`, { refreshToken });
        setTokens(data.data.accessToken, data.data.refreshToken);
        return data.data.accessToken as string;
      } catch { setTokens(null, null); return null; }
      finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
    const token = await refreshing;
    if (token) { original.headers!.Authorization = `Bearer ${token}`; return api(original); }
    window.location.href = '/login';
  }
  throw error;
});

export function apiErrorMessage(err: unknown): string {
  const e = err as AxiosError<{ message?: string; errors?: { field: string; message: string }[] }>;
  if (e.response?.data?.errors?.length)
    return e.response.data.errors.map((x) => `${x.field}: ${x.message}`).join(', ');
  return e.response?.data?.message ?? e.message ?? 'Something went wrong';
}

/** Authenticated PDF download — opens the blob in a new tab. */
export async function openPdf(url: string) {
  const res = await api.get(url, { responseType: 'blob' });
  window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank');
}
